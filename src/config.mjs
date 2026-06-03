import { resolve } from "node:path";

export const CONFIG = {
  marketCapMax: Number(process.env.SCAN_MARKET_CAP_MAX ?? 500_000_000),
  volume24hMin: Number(process.env.SCAN_VOLUME_24H_MIN ?? 1_000_000),
  candidateLimit: Number(process.env.SCAN_CANDIDATE_LIMIT ?? 100),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 12_000),
  coingeckoPages: Number(process.env.COINGECKO_PAGES ?? 4),
  snapshotsFile: resolve(process.env.SNAPSHOTS_FILE ?? "data/market-snapshots.jsonl"),
  scanLookbackMinutes: Number(process.env.SCAN_LOOKBACK_MINUTES ?? 60),
};
