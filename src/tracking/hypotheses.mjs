import { pct, usd } from "../format.mjs";

export const defaultHypothesesFile = "data/setup-hypotheses.jsonl";

export function buildHypothesis(row, { reportGeneratedAt } = {}) {
  const labels = row.labels ?? [];
  const isSilentOiBuild = labels.includes("Silent OI build");
  const isOiMcWatch = labels.includes("OI/MC watch") || labels.includes("OI>MC");
  const thesisType = isSilentOiBuild ? "oi_price_momentum" : "oi_mc_anomaly";
  const bias = isSilentOiBuild ? "long-watch" : "neutral-watch";

  return {
    id: `${row.timestamp}-${row.pair}`,
    createdAt: new Date().toISOString(),
    sourceReportGeneratedAt: reportGeneratedAt,
    sourceTimestamp: row.timestamp,
    pair: row.pair,
    exchange: row.exchange,
    bias,
    thesisType,
    labels,
    entryPrice: row.price,
    entryOi: row.openInterest,
    entryOiMc: row.oiMc,
    marketCap: row.marketCap,
    volume24h: row.volume24h,
    fundingRate: row.fundingRate,
    observedOiChangePct: row.oiChangePct,
    observedPriceChangePct: row.priceChangePct,
    window: row.window,
    thesis: buildThesis(row, { isSilentOiBuild, isOiMcWatch }),
    riskNote: buildRiskNote(row, { isSilentOiBuild, isOiMcWatch }),
  };
}

function buildThesis(row, { isSilentOiBuild, isOiMcWatch }) {
  if (isSilentOiBuild) {
    return [
      `OI grew ${pct(row.oiChangePct)} while price moved ${pct(row.priceChangePct)}.`,
      "Paper thesis: watch for continuation only after chart confirmation.",
    ].join(" ");
  }

  if (isOiMcWatch) {
    return [
      `OI/MC is ${Number(row.oiMc ?? 0).toFixed(2)}.`,
      "Paper thesis: high leverage interest relative to market cap; watch for manipulation, not a standalone entry.",
    ].join(" ");
  }

  return "Paper thesis: watch only; no directional assumption.";
}

function buildRiskNote(row, { isSilentOiBuild, isOiMcWatch }) {
  const notes = [];

  if (isSilentOiBuild && Number(row.priceChangePct) >= 7) {
    notes.push("Price already moved strongly; late-entry risk is high.");
  }

  if (isSilentOiBuild && Number(row.oiChangePct) > Number(row.priceChangePct)) {
    notes.push("OI grew faster than price; this is cleaner than pure price chase.");
  }

  if (isOiMcWatch) {
    notes.push("Needs liquidity, spread, funding and liquidation-map check before any trade idea.");
  }

  if (row.window?.endsWith("*")) {
    notes.push("Lookback window is partial; confidence is lower until a full window is available.");
  }

  return notes.join(" ");
}

export function evaluateHypothesis(hypothesis, snapshots, {
  minFutureMinutes = 15,
  successPct = 5,
  failurePct = -5,
} = {}) {
  const sourceTime = new Date(hypothesis.sourceTimestamp).getTime();
  const future = snapshots
    .filter((row) => row.exchangeSymbol === hypothesis.pair)
    .filter((row) => new Date(row.timestamp).getTime() > sourceTime)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (!future.length) {
    return {
      ...baseEvaluation(hypothesis),
      status: "pending",
      verdict: "waiting_for_future_snapshots",
      futureSnapshots: 0,
      note: "No future snapshots after the hypothesis timestamp yet.",
    };
  }

  const entryPrice = Number(hypothesis.entryPrice);
  const prices = future
    .map((row) => Number(row.price))
    .filter((price) => Number.isFinite(price) && Number.isFinite(entryPrice) && entryPrice > 0);
  const latest = future.at(-1);
  const latestPrice = Number(latest?.price);
  const ageMinutes = (new Date(latest.timestamp).getTime() - sourceTime) / 60_000;

  if (!prices.length) {
    return {
      ...baseEvaluation(hypothesis),
      status: "pending",
      verdict: "missing_future_prices",
      futureSnapshots: future.length,
      ageMinutes,
      note: "Future rows exist, but price data is missing.",
    };
  }

  const latestMovePct = percentMove(latestPrice, entryPrice);
  const maxUpPct = percentMove(Math.max(...prices), entryPrice);
  const maxDownPct = percentMove(Math.min(...prices), entryPrice);
  const status = ageMinutes >= minFutureMinutes ? "ready" : "early";

  return {
    ...baseEvaluation(hypothesis),
    status,
    verdict: buildVerdict(hypothesis, { status, latestMovePct, maxUpPct, maxDownPct, successPct, failurePct }),
    futureSnapshots: future.length,
    ageMinutes,
    entryPrice,
    latestPrice,
    latestMovePct,
    maxUpPct,
    maxDownPct,
    latestTimestamp: latest.timestamp,
  };
}

function baseEvaluation(hypothesis) {
  return {
    id: hypothesis.id,
    pair: hypothesis.pair,
    bias: hypothesis.bias,
    thesisType: hypothesis.thesisType,
    labels: hypothesis.labels,
    sourceTimestamp: hypothesis.sourceTimestamp,
    thesis: hypothesis.thesis,
    riskNote: hypothesis.riskNote,
  };
}

function percentMove(current, entry) {
  if (!Number.isFinite(current) || !Number.isFinite(entry) || entry <= 0) return null;
  return ((current - entry) / entry) * 100;
}

function buildVerdict(hypothesis, { status, latestMovePct, maxUpPct, maxDownPct, successPct, failurePct }) {
  if (status === "early") return "too_early";

  if (hypothesis.bias === "long-watch") {
    if (maxUpPct >= successPct) return "direction_worked";
    if (maxDownPct <= failurePct && maxUpPct < 2) return "direction_failed";
    if (latestMovePct > 0) return "developing_positive";
    if (latestMovePct < 0) return "developing_negative";
    return "unclear";
  }

  const maxAbsMove = Math.max(Math.abs(maxUpPct ?? 0), Math.abs(maxDownPct ?? 0));
  if (maxAbsMove >= successPct) return "movement_detected";
  return "quiet_watch";
}

export function formatEvaluationLine(item) {
  const movement = item.status === "pending"
    ? "no future data"
    : `latest ${pct(item.latestMovePct)} / max up ${pct(item.maxUpPct)} / max down ${pct(item.maxDownPct)}`;

  return [
    item.pair.padEnd(14),
    item.bias.padEnd(13),
    item.verdict.padEnd(24),
    movement,
    item.entryPrice ? `entry ${usd(item.entryPrice)}` : "",
  ].filter(Boolean).join(" | ");
}
