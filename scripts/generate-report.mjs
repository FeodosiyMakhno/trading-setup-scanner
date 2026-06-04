import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { CONFIG } from "../src/config.mjs";
import { pct, usd } from "../src/format.mjs";
import { explainSetup } from "../src/scanner/explain.mjs";
import { buildLatestChangeRows, getSignalLabels, scanSnapshotRecords } from "../src/scanner/rules.mjs";
import { readJsonLines } from "../src/storage/jsonl.mjs";

const outputFile = resolve(process.env.REPORT_FILE ?? "reports/latest-report.html");
const jsonOutputFile = resolve(process.env.REPORT_JSON_FILE ?? "reports/latest-report.json");
const records = await readJsonLines(CONFIG.snapshotsFile);
const latestByPair = latestRecordsByPair(records);
const latestRows = [...latestByPair.values()].sort((a, b) => Number(b.oiMc ?? 0) - Number(a.oiMc ?? 0));
const setups = scanSnapshotRecords(records, {
  lookbackMinutes: CONFIG.scanLookbackMinutes,
});
const changeRows = buildLatestChangeRows(records, {
  lookbackMinutes: CONFIG.scanLookbackMinutes,
});
const reportModel = {
  generatedAt: new Date().toISOString(),
  records,
  latestRows,
  setups,
  changeRows,
};

await mkdir(dirname(outputFile), { recursive: true });
await mkdir(dirname(jsonOutputFile), { recursive: true });
await Promise.all([
  writeFile(outputFile, renderHtml(reportModel), "utf8"),
  writeFile(jsonOutputFile, `${JSON.stringify(buildJsonReport(reportModel), null, 2)}\n`, "utf8"),
]);

console.log(`Report written: ${outputFile}`);
console.log(`JSON report written: ${jsonOutputFile}`);
console.log(`Latest pairs: ${latestRows.length}`);
console.log(`Setup candidates: ${setups.length}`);

function latestRecordsByPair(items) {
  const map = new Map();
  for (const item of items) {
    const key = `${item.exchange}:${item.exchangeSymbol}`;
    const current = map.get(key);
    if (!current || new Date(item.timestamp) > new Date(current.timestamp)) {
      map.set(key, item);
    }
  }
  return map;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function ratioBar(value, max = 1) {
  const number = Number(value);
  const percent = Number.isFinite(number) ? Math.max(0, Math.min(100, (number / max) * 100)) : 0;
  return `<div class="bar"><span style="width:${percent.toFixed(1)}%"></span></div>`;
}

function changeClass(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "muted";
  if (number > 0) return "positive";
  if (number < 0) return "negative";
  return "muted";
}

function badge(label) {
  const className = label === "OI>MC"
    ? "danger"
    : label === "Silent OI build"
      ? "warning"
      : "info";
  return `<span class="badge ${className}">${escapeHtml(label)}</span>`;
}

function windowLabel(row) {
  if (!row.actualLookbackMinutes) return "n/a";
  const rounded = Math.round(row.actualLookbackMinutes);
  return `${rounded}m${row.isPartialLookback ? "*" : ""}`;
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function sortedByAbsChange(rows, key, limit = 30) {
  return rows
    .filter((row) => isFiniteNumber(row[key]))
    .toSorted((a, b) => Math.abs(Number(b[key])) - Math.abs(Number(a[key])))
    .slice(0, limit);
}

function renderChangeTable(rows, focusLabel) {
  if (!rows.length) {
    return `<div class="empty">Not enough snapshot history yet. Collect more data and generate the report again.</div>`;
  }

  return `
    <table>
      <thead>
        <tr>
          <th>#</th><th>Pair</th><th>Window</th><th>Focus</th><th>OI</th><th>Price</th><th>OI/MC</th><th>OI Value</th><th>MC</th><th>Funding</th><th>Signal</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row, index) => `
          <tr>
            <td class="rank">${index + 1}</td>
            <td><strong>${escapeHtml(row.exchangeSymbol)}</strong></td>
            <td>${escapeHtml(windowLabel(row))}</td>
            <td>${escapeHtml(focusLabel)}</td>
            <td class="${changeClass(row.oiChangePct)}">${pct(row.oiChangePct)}</td>
            <td class="${changeClass(row.priceChangePct)}">${pct(row.priceChangePct)}</td>
            <td><strong>${Number(row.oiMc ?? 0).toFixed(2)}</strong>${ratioBar(row.oiMc, 1)}</td>
            <td>${usd(row.openInterest)}</td>
            <td>${usd(row.marketCap)}</td>
            <td class="${changeClass(row.fundingRate)}">${pct(row.fundingRate)}</td>
            <td>${row.labels.map(badge).join("") || '<span class="muted">none</span>'}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function digestRow(row) {
  const explanation = row.labels?.length ? explainSetup(row) : null;

  return {
    pair: row.exchangeSymbol,
    exchange: row.exchange,
    name: row.name,
    coingeckoId: row.coingeckoId,
    timestamp: row.timestamp,
    window: windowLabel(row),
    labels: row.labels ?? [],
    oiMc: row.oiMc,
    openInterest: row.openInterest,
    marketCap: row.marketCap,
    volume24h: row.volume24h,
    fundingRate: row.fundingRate,
    price: row.price,
    priceChangePct: row.priceChangePct,
    oiChangePct: row.oiChangePct,
    volume24hChangePct: row.volume24hChangePct,
    reason: explanation?.reason ?? null,
    nextCheck: explanation?.nextCheck ?? null,
  };
}

function buildJsonReport({ generatedAt, records, latestRows, setups, changeRows }) {
  return {
    generatedAt,
    mode: CONFIG.scanMode,
    snapshotsFile: CONFIG.snapshotsFile,
    lookbackMinutes: CONFIG.scanLookbackMinutes,
    snapshotRows: records.length,
    latestPairs: latestRows.length,
    setupCandidates: setups.slice(0, 30).map(digestRow),
    topOiMcCandidates: latestRows.slice(0, 50).map(digestRow),
    topOiChange: sortedByAbsChange(changeRows, "oiChangePct").map(digestRow),
    topPriceChange: sortedByAbsChange(changeRows, "priceChangePct").map(digestRow),
  };
}

function renderHtml({ generatedAt, records, latestRows, setups, changeRows }) {
  const topOiChangeRows = sortedByAbsChange(changeRows, "oiChangePct");
  const topPriceChangeRows = sortedByAbsChange(changeRows, "priceChangePct");

  const rows = latestRows.slice(0, 50).map((row, index) => {
    const labels = getSignalLabels({
      ...row,
      oiChangePct: row.oiChangePct,
      priceChangePct: row.priceChangePct,
    });

    return `
      <tr>
        <td class="rank">${index + 1}</td>
        <td>
          <strong>${escapeHtml(row.exchangeSymbol)}</strong>
          <div class="sub">${escapeHtml(row.name)} · ${escapeHtml(row.coingeckoId)}</div>
        </td>
        <td>
          <strong>${Number(row.oiMc ?? 0).toFixed(2)}</strong>
          ${ratioBar(row.oiMc, 1)}
        </td>
        <td>${usd(row.openInterest)}</td>
        <td>${usd(row.marketCap)}</td>
        <td>${usd(row.volume24h)}</td>
        <td class="${changeClass(row.priceChange24h)}">${pct(row.priceChange24h)}</td>
        <td class="${changeClass(row.fundingRate)}">${pct(row.fundingRate)}</td>
        <td>${labels.map(badge).join("") || '<span class="muted">none</span>'}</td>
      </tr>
    `;
  }).join("");

  const setupRows = setups.slice(0, 30).map((setup, index) => {
    const explanation = explainSetup(setup);

    return `
      <tr>
        <td class="rank">${index + 1}</td>
        <td><strong>${escapeHtml(setup.exchangeSymbol)}</strong></td>
        <td>${setup.labels.map(badge).join("")}</td>
        <td>${escapeHtml(windowLabel(setup))}</td>
        <td><strong>${Number(setup.oiMc ?? 0).toFixed(2)}</strong>${ratioBar(setup.oiMc, 1)}</td>
        <td class="${changeClass(setup.oiChangePct)}">${pct(setup.oiChangePct)}</td>
        <td class="${changeClass(setup.priceChangePct)}">${pct(setup.priceChangePct)}</td>
        <td>${usd(setup.marketCap)}</td>
        <td class="${changeClass(setup.fundingRate)}">${pct(setup.fundingRate)}</td>
        <td class="note">${escapeHtml(explanation.reason)}</td>
        <td class="note">${escapeHtml(explanation.nextCheck)}</td>
      </tr>
    `;
  }).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Trading Setup Scanner Report</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #111315;
      --panel: #181b1f;
      --line: #2a2f36;
      --text: #f2f4f6;
      --muted: #9aa4af;
      --green: #43d17a;
      --red: #ff6b6b;
      --yellow: #ffd166;
      --blue: #62a8ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.45;
    }
    main { max-width: 1180px; margin: 0 auto; padding: 28px 18px 48px; }
    header { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; margin-bottom: 22px; }
    h1 { margin: 0 0 6px; font-size: 28px; letter-spacing: 0; }
    h2 { margin: 28px 0 12px; font-size: 18px; letter-spacing: 0; }
    .sub, .muted { color: var(--muted); font-size: 13px; }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 18px 0 8px; }
    .metric {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
    }
    .metric span { color: var(--muted); display: block; font-size: 12px; margin-bottom: 4px; }
    .metric strong { font-size: 22px; }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }
    th, td { padding: 10px 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: middle; }
    th { color: var(--muted); font-size: 12px; font-weight: 600; background: #14171a; }
    tr:last-child td { border-bottom: 0; }
    .rank { color: var(--muted); width: 44px; text-align: right; }
    .note { min-width: 220px; max-width: 320px; color: #d8dee5; font-size: 13px; }
    .positive { color: var(--green); }
    .negative { color: var(--red); }
    .bar { height: 5px; width: 92px; background: #282d33; border-radius: 99px; margin-top: 5px; overflow: hidden; }
    .bar span { display: block; height: 100%; background: var(--blue); border-radius: inherit; }
    .badge {
      display: inline-block;
      margin: 2px 4px 2px 0;
      padding: 2px 7px;
      border-radius: 999px;
      font-size: 12px;
      color: #111315;
      background: var(--muted);
      white-space: nowrap;
    }
    .badge.danger { background: var(--red); }
    .badge.warning { background: var(--yellow); }
    .badge.info { background: var(--blue); }
    .empty {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 18px;
      color: var(--muted);
    }
    @media (max-width: 820px) {
      header { display: block; }
      .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      table { font-size: 13px; }
      th, td { padding: 8px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Trading Setup Scanner</h1>
        <div class="sub">Generated ${escapeHtml(generatedAt)} · source ${escapeHtml(CONFIG.snapshotsFile)}</div>
      </div>
      <div class="sub">Analytical scanner only. Manual verification required.</div>
    </header>

    <section class="summary">
      <div class="metric"><span>Snapshot rows</span><strong>${records.length}</strong></div>
      <div class="metric"><span>Latest pairs</span><strong>${latestRows.length}</strong></div>
      <div class="metric"><span>Setup candidates</span><strong>${setups.length}</strong></div>
      <div class="metric"><span>Lookback</span><strong>${CONFIG.scanLookbackMinutes}m</strong></div>
    </section>

    <h2>Setup Candidates</h2>
    ${setups.length ? `
      <table>
        <thead>
          <tr>
            <th>#</th><th>Pair</th><th>Signal</th><th>Window</th><th>OI/MC</th><th>OI Change</th><th>Price Change</th><th>MC</th><th>Funding</th><th>Reason</th><th>Next Check</th>
          </tr>
        </thead>
        <tbody>${setupRows}</tbody>
      </table>
    ` : `<div class="empty">No setup candidates yet. Collect snapshots over time, then generate the report again.</div>`}

    <h2>Top OI/MC Candidates</h2>
    <table>
      <thead>
        <tr>
          <th>#</th><th>Pair</th><th>OI/MC</th><th>OI</th><th>MC</th><th>Vol 24h</th><th>24h</th><th>Funding</th><th>Signal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <h2>Top OI Change</h2>
    ${renderChangeTable(topOiChangeRows, "OI")}

    <h2>Top Price Change</h2>
    ${renderChangeTable(topPriceChangeRows, "Price")}
  </main>
</body>
</html>`;
}
