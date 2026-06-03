import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { CONFIG } from "../config.mjs";
import { fetchJson, sleep } from "../http.mjs";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export async function getCoinGeckoMarketsBySymbol() {
  const cached = await readFreshCache();
  if (cached) {
    return marketsBySymbol(cached.markets);
  }

  const pages = [];
  try {
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
  } catch (error) {
    const staleCache = await readAnyCache();
    if (staleCache) {
      console.warn(`Using stale CoinGecko cache after fetch failure: ${error.message.split("\n")[0]}`);
      return marketsBySymbol(staleCache.markets);
    }
    throw error;
  }

  await writeCache(pages);
  return marketsBySymbol(pages);
}

function marketsBySymbol(markets) {
  const bySymbol = new Map();
  for (const coin of markets) {
    const symbol = coin.symbol?.toUpperCase();
    if (!symbol) continue;

    const existing = bySymbol.get(symbol);
    if (!existing || Number(coin.market_cap || 0) > Number(existing.market_cap || 0)) {
      bySymbol.set(symbol, coin);
    }
  }

  return bySymbol;
}

async function readFreshCache() {
  const cache = await readAnyCache();
  if (!cache) return null;

  const ageMs = Date.now() - new Date(cache.createdAt).getTime();
  const ttlMs = CONFIG.coingeckoCacheTtlMinutes * 60_000;

  if (ageMs >= 0 && ageMs <= ttlMs && Array.isArray(cache.markets)) {
    return cache;
  }

  return null;
}

async function readAnyCache() {
  let text;
  try {
    text = await readFile(CONFIG.coingeckoCacheFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }

  const cache = JSON.parse(text);
  if (Array.isArray(cache.markets)) {
    return cache;
  }

  return null;
}

async function writeCache(markets) {
  await mkdir(dirname(CONFIG.coingeckoCacheFile), { recursive: true });
  await writeFile(
    CONFIG.coingeckoCacheFile,
    JSON.stringify({ createdAt: new Date().toISOString(), markets }, null, 2),
    "utf8",
  );
}
