import { resolve } from "node:path";

const scanModeArg = process.argv
  .find((arg) => arg.startsWith("--mode="))
  ?.split("=")
  .at(1);

const scanMode = (scanModeArg ?? process.env.SCAN_MODE ?? "strict").toLowerCase();

const thresholdPresets = {
  strict: {
    oiMcMin: 1,
    silentOiBuildMinOiChangePct: 50,
    silentOiBuildMinPriceChangePct: -5,
    silentOiBuildMaxPriceChangePct: 10,
    priceWithoutOiMinPriceChangePct: 20,
    priceWithoutOiMaxAbsOiChangePct: 5,
  },
  test: {
    oiMcMin: 0.25,
    silentOiBuildMinOiChangePct: 5,
    silentOiBuildMinPriceChangePct: -5,
    silentOiBuildMaxPriceChangePct: 10,
    priceWithoutOiMinPriceChangePct: 10,
    priceWithoutOiMaxAbsOiChangePct: 2,
  },
};

export const CONFIG = {
  scanMode,
  thresholds: thresholdPresets[scanMode] ?? thresholdPresets.strict,
  marketCapMax: Number(process.env.SCAN_MARKET_CAP_MAX ?? 500_000_000),
  volume24hMin: Number(process.env.SCAN_VOLUME_24H_MIN ?? 1_000_000),
  candidateLimit: Number(process.env.SCAN_CANDIDATE_LIMIT ?? 100),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 12_000),
  coingeckoPages: Number(process.env.COINGECKO_PAGES ?? 4),
  coingeckoCacheFile: resolve(process.env.COINGECKO_CACHE_FILE ?? "data/coingecko-markets-cache.json"),
  coingeckoCacheTtlMinutes: Number(process.env.COINGECKO_CACHE_TTL_MINUTES ?? 60),
  snapshotsFile: resolve(process.env.SNAPSHOTS_FILE ?? "data/market-snapshots.jsonl"),
  scanLookbackMinutes: Number(process.env.SCAN_LOOKBACK_MINUTES ?? 60),
};
