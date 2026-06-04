import { CONFIG } from "../config.mjs";
import { pct } from "../format.mjs";

function ratio(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "n/a";
}

function hasLabel(row, label) {
  return Array.isArray(row.labels) && row.labels.includes(label);
}

function addUnique(items, value) {
  if (!items.includes(value)) items.push(value);
}

export function explainSetup(row) {
  const thresholds = CONFIG.thresholds;
  const reasons = [];
  const nextChecks = [];

  if (hasLabel(row, "OI>MC") || hasLabel(row, "OI/MC watch")) {
    reasons.push(`OI/MC is ${ratio(row.oiMc)} against threshold ${ratio(thresholds.oiMcMin)}.`);
    addUnique(nextChecks, "Check liquidity, spread, funding and liquidation map before any entry.");
  }

  if (hasLabel(row, "Silent OI build")) {
    reasons.push(`OI changed ${pct(row.oiChangePct)} while price changed ${pct(row.priceChangePct)}.`);
    addUnique(nextChecks, "Wait for breakout confirmation or failed breakout; avoid entering only from OI growth.");
  }

  if (hasLabel(row, "Price without OI")) {
    reasons.push(`Price changed ${pct(row.priceChangePct)} while OI stayed near flat at ${pct(row.oiChangePct)}.`);
    addUnique(nextChecks, "Treat as weak participation until OI, volume or structure confirms the move.");
  }

  if (row.isPartialLookback) {
    reasons.push(`Window is partial: ${Math.round(row.actualLookbackMinutes)}m of target ${row.lookbackMinutes}m.`);
    addUnique(nextChecks, "Recheck after full lookback before treating the setup as stable.");
  }

  return {
    reason: reasons.join(" ") || "No active setup reason.",
    nextCheck: nextChecks.join(" ") || "Use as context only; no standalone trade trigger.",
  };
}
