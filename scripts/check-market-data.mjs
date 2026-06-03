const BYBIT_BASE = "https://api.bybit.com";
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

const CONFIG = {
  marketCapMax: Number(process.env.SCAN_MARKET_CAP_MAX ?? 500_000_000),
  volume24hMin: Number(process.env.SCAN_VOLUME_24H_MIN ?? 1_000_000),
  candidateLimit: Number(process.env.SCAN_CANDIDATE_LIMIT ?? 100),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 12_000),
};

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "trading-setup-scanner/0.1",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${response.status} ${response.statusText} for ${url}\n${text.slice(0, 300)}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function usd(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "n/a";
  if (Math.abs(number) >= 1_000_000_000) return `$${(number / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(number) >= 1_000_000) return `$${(number / 1_000_000).toFixed(2)}M`;
  if (Math.abs(number) >= 1_000) return `$${(number / 1_000).toFixed(2)}K`;
  return `$${number.toFixed(2)}`;
}

function pct(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "n/a";
  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

async function getBybitLinearTickers() {
  const data = await fetchJson(`${BYBIT_BASE}/v5/market/tickers?category=linear`);
  if (data.retCode !== 0) {
    throw new Error(`Bybit retCode ${data.retCode}: ${data.retMsg}`);
  }

  return data.result.list
    .filter((ticker) => ticker.symbol.endsWith("USDT"))
    .map((ticker) => ({
      exchangeSymbol: ticker.symbol,
      symbol: ticker.symbol.replace(/USDT$/, ""),
      price: Number(ticker.lastPrice),
      volume24h: Number(ticker.turnover24h),
      openInterest: Number(ticker.openInterestValue),
      priceChange24h: Number(ticker.price24hPcnt) * 100,
      fundingRate: Number(ticker.fundingRate) * 100,
    }))
    .filter((ticker) => Number.isFinite(ticker.price) && Number.isFinite(ticker.openInterest));
}

async function getCoinGeckoMarkets() {
  const pages = [];
  for (let page = 1; page <= 4; page += 1) {
    const url = new URL(`${COINGECKO_BASE}/coins/markets`);
    url.searchParams.set("vs_currency", "usd");
    url.searchParams.set("order", "volume_desc");
    url.searchParams.set("per_page", "250");
    url.searchParams.set("page", String(page));
    url.searchParams.set("sparkline", "false");
    url.searchParams.set("price_change_percentage", "24h");
    pages.push(...await fetchJson(url));
    await sleep(1200);
  }

  const bySymbol = new Map();
  for (const coin of pages) {
    const symbol = coin.symbol?.toUpperCase();
    if (!symbol) continue;

    const existing = bySymbol.get(symbol);
    if (!existing || Number(coin.market_cap || 0) > Number(existing.market_cap || 0)) {
      bySymbol.set(symbol, coin);
    }
  }
  return bySymbol;
}

async function getBybitOpenInterestHistory(symbol) {
  const url = new URL(`${BYBIT_BASE}/v5/market/open-interest`);
  url.searchParams.set("category", "linear");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("intervalTime", "1h");
  url.searchParams.set("limit", "2");

  const data = await fetchJson(url);
  if (data.retCode !== 0) return null;

  const points = data.result?.list ?? [];
  if (points.length < 2) return null;

  const sorted = points
    .map((point) => ({
      value: Number(point.openInterest),
      timestamp: Number(point.timestamp),
    }))
    .filter((point) => Number.isFinite(point.value) && Number.isFinite(point.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (sorted.length < 2) return null;
  const previous = sorted.at(-2).value;
  const current = sorted.at(-1).value;
  if (previous <= 0) return null;

  return ((current - previous) / previous) * 100;
}

async function getBybitKline1hChange(symbol) {
  const url = new URL(`${BYBIT_BASE}/v5/market/kline`);
  url.searchParams.set("category", "linear");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", "60");
  url.searchParams.set("limit", "2");

  const data = await fetchJson(url);
  if (data.retCode !== 0) return null;

  const candles = data.result?.list ?? [];
  if (candles.length < 2) return null;

  const sorted = candles
    .map((candle) => ({
      timestamp: Number(candle[0]),
      open: Number(candle[1]),
      close: Number(candle[4]),
      turnover: Number(candle[6]),
    }))
    .filter((candle) => (
      Number.isFinite(candle.timestamp) &&
      Number.isFinite(candle.open) &&
      Number.isFinite(candle.close)
    ))
    .sort((a, b) => a.timestamp - b.timestamp);

  const latest = sorted.at(-1);
  if (!latest || latest.open <= 0) return null;

  return {
    priceChange1h: ((latest.close - latest.open) / latest.open) * 100,
    turnover1h: latest.turnover,
  };
}

function rankCandidates(bybitTickers, coinGeckoBySymbol, limit = CONFIG.candidateLimit) {
  return bybitTickers
    .map((ticker) => {
      const coin = coinGeckoBySymbol.get(ticker.symbol);
      const marketCap = Number(coin?.market_cap);
      const fdv = Number(coin?.fully_diluted_valuation);
      const oiMc = marketCap > 0 ? ticker.openInterest / marketCap : null;

      return {
        ...ticker,
        coingeckoId: coin?.id ?? null,
        name: coin?.name ?? ticker.symbol,
        marketCap,
        fdv,
        oiMc,
      };
    })
    .filter((item) => item.coingeckoId && Number.isFinite(item.oiMc))
    .filter((item) => item.marketCap > 0 && item.marketCap <= CONFIG.marketCapMax)
    .filter((item) => item.volume24h >= CONFIG.volume24hMin)
    .sort((a, b) => b.oiMc - a.oiMc)
    .slice(0, limit);
}

function getSignalLabels(item) {
  const labels = [];
  if (item.oiMc >= 1) labels.push("OI>MC");
  if (item.oiChange1h >= 50 && item.priceChange1h >= -5 && item.priceChange1h <= 10) {
    labels.push("Silent OI build");
  }
  if (item.priceChange1h >= 20 && Math.abs(item.oiChange1h ?? Infinity) <= 5) {
    labels.push("Price without OI");
  }
  return labels;
}

async function enrichCandidate(candidate) {
  const [oiChange1h, kline] = await Promise.all([
    getBybitOpenInterestHistory(candidate.exchangeSymbol).catch(() => null),
    getBybitKline1hChange(candidate.exchangeSymbol).catch(() => null),
  ]);

  return {
    ...candidate,
    oiChange1h,
    priceChange1h: kline?.priceChange1h ?? null,
    turnover1h: kline?.turnover1h ?? null,
  };
}

const bybitTickers = await getBybitLinearTickers();
const coinGeckoBySymbol = await getCoinGeckoMarkets();
const candidates = rankCandidates(bybitTickers, coinGeckoBySymbol);
const enriched = [];

for (const candidate of candidates) {
  enriched.push(await enrichCandidate(candidate));
  await sleep(150);
}

console.log(`Bybit USDT perpetual tickers: ${bybitTickers.length}`);
console.log(`CoinGecko symbols indexed: ${coinGeckoBySymbol.size}`);
console.log("");
console.log(`Top OI/MC candidates under ${usd(CONFIG.marketCapMax)} market cap:`);
console.log("");

for (const [index, item] of candidates.slice(0, 25).entries()) {
  console.log(
    `${String(index + 1).padStart(2, " ")}. ${item.exchangeSymbol.padEnd(14)} ` +
      `OI/MC ${item.oiMc.toFixed(2).padStart(6)} | ` +
      `OI ${usd(item.openInterest).padStart(9)} | ` +
      `MC ${usd(item.marketCap).padStart(9)} | ` +
      `Vol24 ${usd(item.volume24h).padStart(9)} | ` +
      `24h ${pct(item.priceChange24h).padStart(8)} | ` +
      `Funding ${pct(item.fundingRate).padStart(8)} | ` +
      `${item.name} (${item.coingeckoId})`
  );
}

console.log("");
console.log("Same candidates enriched with 1h OI/price data:");
console.log("");

for (const [index, item] of enriched.slice(0, 25).entries()) {
  const labels = getSignalLabels(item);
  console.log(
    `${String(index + 1).padStart(2, " ")}. ${item.exchangeSymbol.padEnd(14)} ` +
      `OI/MC ${item.oiMc.toFixed(2).padStart(6)} | ` +
      `OI 1h ${pct(item.oiChange1h).padStart(8)} | ` +
      `Price 1h ${pct(item.priceChange1h).padStart(8)} | ` +
      `Turnover1h ${usd(item.turnover1h).padStart(9)} | ` +
      `${labels.length ? labels.join(", ") : "no MVP signal"}`
  );
}

const signalCandidates = enriched
  .map((item) => ({ ...item, labels: getSignalLabels(item) }))
  .filter((item) => item.labels.length > 0);

console.log("");
console.log(`MVP signals found among ${enriched.length} enriched candidates: ${signalCandidates.length}`);
console.log("");

for (const [index, item] of signalCandidates.slice(0, 25).entries()) {
  console.log(
    `${String(index + 1).padStart(2, " ")}. ${item.exchangeSymbol.padEnd(14)} ` +
      `${item.labels.join(", ").padEnd(18)} | ` +
      `OI/MC ${item.oiMc.toFixed(2).padStart(6)} | ` +
      `OI 1h ${pct(item.oiChange1h).padStart(8)} | ` +
      `Price 1h ${pct(item.priceChange1h).padStart(8)} | ` +
      `MC ${usd(item.marketCap).padStart(9)} | ` +
      `Funding ${pct(item.fundingRate).padStart(8)}`
  );
}
