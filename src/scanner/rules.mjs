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

export function getSignalLabels(item) {
  const labels = [];
  if (item.oiMc >= 1) labels.push("OI>MC");
  if (item.oiChangePct >= 50 && item.priceChangePct >= -5 && item.priceChangePct <= 10) {
    labels.push("Silent OI build");
  }
  if (item.priceChangePct >= 20 && Math.abs(item.oiChangePct ?? Infinity) <= 5) {
    labels.push("Price without OI");
  }
  return labels;
}

export function scanSnapshotRecords(records, { lookbackMinutes = 60 } = {}) {
  const setups = [];
  const groups = groupByPair(records);

  for (const group of groups.values()) {
    const latest = group.at(-1);
    const previous = findPreviousSnapshot(group, latest, lookbackMinutes);
    if (!previous) continue;

    const candidate = {
      ...latest,
      lookbackMinutes,
      priceChangePct: percentChange(latest.price, previous.price),
      oiChangePct: percentChange(latest.openInterest, previous.openInterest),
      volume24hChangePct: percentChange(latest.volume24h, previous.volume24h),
    };
    candidate.labels = getSignalLabels(candidate);

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
