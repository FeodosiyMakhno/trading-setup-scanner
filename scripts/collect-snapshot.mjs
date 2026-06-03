import { CONFIG } from "../src/config.mjs";
import { usd, pct } from "../src/format.mjs";
import { buildCandidates } from "../src/market/candidates.mjs";
import { getBybitLinearTickers } from "../src/providers/bybit.mjs";
import { getCoinGeckoMarketsBySymbol } from "../src/providers/coingecko.mjs";
import { appendJsonLines } from "../src/storage/jsonl.mjs";

const timestamp = new Date().toISOString();
const bybitTickers = await getBybitLinearTickers();
const coinGeckoBySymbol = await getCoinGeckoMarketsBySymbol();
const candidates = buildCandidates(bybitTickers, coinGeckoBySymbol);

const snapshots = candidates.map((item) => ({
  timestamp,
  exchange: item.exchange,
  exchangeSymbol: item.exchangeSymbol,
  symbol: item.symbol,
  quote: item.quote,
  coingeckoId: item.coingeckoId,
  name: item.name,
  price: item.price,
  volume24h: item.volume24h,
  marketCap: item.marketCap,
  fdv: item.fdv,
  openInterest: item.openInterest,
  oiMc: item.oiMc,
  fundingRate: item.fundingRate,
  priceChange24h: item.priceChange24h,
}));

await appendJsonLines(CONFIG.snapshotsFile, snapshots);

console.log(`Snapshot time: ${timestamp}`);
console.log(`Bybit USDT perpetual tickers: ${bybitTickers.length}`);
console.log(`CoinGecko symbols indexed: ${coinGeckoBySymbol.size}`);
console.log(`Snapshots written: ${snapshots.length}`);
console.log(`File: ${CONFIG.snapshotsFile}`);
console.log("");
console.log(`Top OI/MC candidates under ${usd(CONFIG.marketCapMax)} market cap:`);
console.log("");

for (const [index, item] of snapshots.slice(0, 15).entries()) {
  console.log(
    `${String(index + 1).padStart(2, " ")}. ${item.exchangeSymbol.padEnd(14)} ` +
      `OI/MC ${item.oiMc.toFixed(2).padStart(6)} | ` +
      `OI ${usd(item.openInterest).padStart(9)} | ` +
      `MC ${usd(item.marketCap).padStart(9)} | ` +
      `Vol24 ${usd(item.volume24h).padStart(9)} | ` +
      `24h ${pct(item.priceChange24h).padStart(8)} | ` +
      `Funding ${pct(item.fundingRate).padStart(8)}`
  );
}
