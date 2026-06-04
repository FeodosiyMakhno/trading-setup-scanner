import { CONFIG } from "../config.mjs";

function percentChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function groupByPair(records) {
  const groups = new Map();
  for (const record of records) {
    const key = `${record.exchange}:${record.exchangeSymbol}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }

  for (const group of groups.values()) {
    group.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  return groups;
}

function findPreviousSnapshot(group, latest, lookbackMinutes) {
  const targetTime = new Date(latest.timestamp).getTime() - lookbackMinutes * 60_000;
  const candidates = group.filter((item) => new Date(item.timestamp).getTime() <= targetTime);
  return candidates.at(-1) ?? null;
}

function findAnyPreviousSnapshot(group, latest) {
  const latestTime = new Date(latest.timestamp).getTime();
  const candidates = group.filter((item) => new Date(item.timestamp).getTime() < latestTime);
  return candidates.at(0) ?? null;
}

function minutesBetween(current, previous) {
  if (!current || !previous) return null;
  const diffMs = new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return null;
  return diffMs / 60_000;
}

export function getSignalLabels(item) {
  const thresholds = CONFIG.thresholds;
  const labels = [];

  if (item.oiMc >= thresholds.oiMcMin) {
    labels.push(thresholds.oiMcMin >= 1 ? "OI>MC" : "OI/MC watch");
  }

  if (
    item.oiChangePct >= thresholds.silentOiBuildMinOiChangePct &&
    item.priceChangePct >= thresholds.silentOiBuildMinPriceChangePct &&
    item.priceChangePct <= thresholds.silentOiBuildMaxPriceChangePct
  ) {
    labels.push("Silent OI build");
  }

  if (
    item.priceChangePct >= thresholds.priceWithoutOiMinPriceChangePct &&
    Math.abs(item.oiChangePct ?? Infinity) <= thresholds.priceWithoutOiMaxAbsOiChangePct
  ) {
    labels.push("Price without OI");
  }

  return labels;
}

export function buildLatestChangeRows(records, { lookbackMinutes = 60 } = {}) {
  const rows = [];
  const groups = groupByPair(records);
  const allowPartialLookback = CONFIG.scanMode === "test";

  for (const group of groups.values()) {
    const latest = group.at(-1);
    const fullLookbackPrevious = findPreviousSnapshot(group, latest, lookbackMinutes);
    const previous = fullLookbackPrevious ?? (allowPartialLookback ? findAnyPreviousSnapshot(group, latest) : null);
    const actualLookbackMinutes = minutesBetween(latest, previous);

    const candidate = {
      ...latest,
      lookbackMinutes,
      actualLookbackMinutes,
      isPartialLookback: Boolean(previous && !fullLookbackPrevious),
      priceChangePct: previous ? percentChange(latest.price, previous.price) : null,
      oiChangePct: previous ? percentChange(latest.openInterest, previous.openInterest) : null,
      volume24hChangePct: previous ? percentChange(latest.volume24h, previous.volume24h) : null,
    };
    candidate.labels = getSignalLabels(candidate);
    rows.push(candidate);
  }

  return rows;
}

export function scanSnapshotRecords(records, { lookbackMinutes = 60 } = {}) {
  const setups = [];

  for (const candidate of buildLatestChangeRows(records, { lookbackMinutes })) {
    if (candidate.labels.length > 0) {
      setups.push(candidate);
    }
  }

  return setups.sort((a, b) => {
    const scoreA = a.labels.length * 100 + Number(a.oiMc ?? 0) * 10 + Math.abs(Number(a.oiChangePct ?? 0));
    const scoreB = b.labels.length * 100 + Number(b.oiMc ?? 0) * 10 + Math.abs(Number(b.oiChangePct ?? 0));
    return scoreB - scoreA;
  });
}
