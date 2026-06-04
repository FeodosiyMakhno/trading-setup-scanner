import { pct, usd } from "../format.mjs";

export const defaultTelegramAlertsSentFile = "data/telegram-alerts-sent.jsonl";

export function buildTelegramAlerts(report) {
  const rows = report.setupCandidates ?? [];
  return rows
    .filter((row) => row.labels?.includes("Silent OI build"))
    .map((row) => ({
      key: `${row.timestamp}:${row.pair}:${row.labels.join(",")}`,
      pair: row.pair,
      text: formatAlert(report, row),
    }));
}

function formatAlert(report, row) {
  return [
    `Кандидат для ручной проверки: ${row.pair}`,
    "",
    `Signal: ${row.labels.join(", ")}`,
    `Window: ${row.window}`,
    `Price: ${usd(row.price)}`,
    `OI change: ${pct(row.oiChangePct)}`,
    `Price change: ${pct(row.priceChangePct)}`,
    `OI/MC: ${Number(row.oiMc ?? 0).toFixed(2)}`,
    `Funding: ${pct(row.fundingRate)}`,
    "",
    `Reason: ${row.reason ?? "n/a"}`,
    `Next check: ${row.nextCheck ?? "Открой график и проверь структуру, SL, TP/RR."}`,
    "",
    "Это не команда входить. Это alert: открыть график и проверить руками.",
    `Report: ${report.generatedAt}`,
  ].join("\n");
}
