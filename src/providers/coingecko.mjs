import { CONFIG } from "../config.mjs";
import { fetchJson, sleep } from "../http.mjs";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export async function getCoinGeckoMarketsBySymbol() {
  const pages = [];
  for (let page = 1; page <= CONFIG.coingeckoPages; page += 1) {
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
