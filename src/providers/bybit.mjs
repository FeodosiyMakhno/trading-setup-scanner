import { fetchJson } from "../http.mjs";

const BYBIT_BASE = "https://api.bybit.com";

export async function getBybitLinearTickers() {
  const data = await fetchJson(`${BYBIT_BASE}/v5/market/tickers?category=linear`);
  if (data.retCode !== 0) {
    throw new Error(`Bybit retCode ${data.retCode}: ${data.retMsg}`);
  }

  return data.result.list
    .filter((ticker) => ticker.symbol.endsWith("USDT"))
    .map((ticker) => ({
      exchange: "bybit",
      exchangeSymbol: ticker.symbol,
      symbol: ticker.symbol.replace(/USDT$/, ""),
      quote: "USDT",
      price: Number(ticker.lastPrice),
      volume24h: Number(ticker.turnover24h),
      openInterest: Number(ticker.openInterestValue),
      priceChange24h: Number(ticker.price24hPcnt) * 100,
      fundingRate: Number(ticker.fundingRate) * 100,
    }))
    .filter((ticker) => Number.isFinite(ticker.price) && Number.isFinite(ticker.openInterest));
}
