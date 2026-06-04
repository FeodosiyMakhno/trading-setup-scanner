import { pct, usd } from "../format.mjs";

const maxListRows = 8;

export const ACTIONS = {
  main: "main",
  setups: "setups",
  oiChange: "oi_change",
  priceChange: "price_change",
  oiMc: "oi_mc",
  refresh: "refresh",
};

function button(text, callbackData) {
  return { text, callback_data: callbackData };
}

function keyboard(rows) {
  return { inline_keyboard: rows };
}

function generatedAtLabel(value) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function oneLine(value, fallback = "n/a") {
  return String(value ?? fallback).replace(/\s+/g, " ").trim();
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function formatRow(row, index) {
  const labels = row.labels?.length ? row.labels.join(", ") : "none";
  const parts = [
    `${index + 1}. ${row.pair}`,
    `Signal: ${labels}`,
  ];

  if (row.window && row.window !== "n/a") parts.push(`Window: ${row.window}`);
  if (isFiniteNumber(row.oiChangePct)) parts.push(`OI: ${pct(row.oiChangePct)}`);
  if (isFiniteNumber(row.priceChangePct)) parts.push(`Price: ${pct(row.priceChangePct)}`);
  if (isFiniteNumber(row.oiMc)) parts.push(`OI/MC: ${Number(row.oiMc).toFixed(2)}`);

  return parts.join(" | ");
}

function rowButtons(rows, prefix) {
  return rows.slice(0, maxListRows).map((row, index) => [
    button(`${index + 1}. ${row.pair}`, `${prefix}:${index}`),
  ]);
}

function mainKeyboard() {
  return keyboard([
    [button("Сетапы", ACTIONS.setups), button("OI change", ACTIONS.oiChange)],
    [button("Price change", ACTIONS.priceChange), button("OI/MC", ACTIONS.oiMc)],
    [button("Обновить", ACTIONS.refresh)],
  ]);
}

function backKeyboard(extraRows = [], backAction = ACTIONS.main, backText = "Назад") {
  return keyboard([
    ...extraRows,
    [button(backText, backAction), button("Обновить", ACTIONS.refresh)],
  ]);
}

export function renderMain(report) {
  return {
    text: [
      "Trading Setup Scanner",
      "",
      `Режим: ${report.mode}`,
      `Снапшоты: ${report.snapshotRows}`,
      `Монеты в отчете: ${report.latestPairs}`,
      `Кандидаты: ${report.setupCandidates?.length ?? 0}`,
      `Lookback: ${report.lookbackMinutes}m`,
      `Обновлено: ${generatedAtLabel(report.generatedAt)}`,
      "",
      "Выбирай раздел кнопками ниже.",
    ].join("\n"),
    reply_markup: mainKeyboard(),
  };
}

export function renderList(report, key, title, prefix) {
  const rows = report[key] ?? [];
  const visible = rows.slice(0, maxListRows);
  const text = [
    title,
    "",
    visible.length
      ? visible.map(formatRow).join("\n\n")
      : "Пока нет данных для этого раздела.",
  ].join("\n");

  return {
    text,
    reply_markup: backKeyboard(rowButtons(visible, prefix)),
  };
}

export function renderDetails(report, key, index, backAction = ACTIONS.main) {
  const rows = report[key] ?? [];
  const row = rows[index];

  if (!row) {
    return {
      text: "Запись не найдена. Обнови отчет и открой раздел еще раз.",
      reply_markup: backKeyboard([], backAction, "К списку"),
    };
  }

  const labels = row.labels?.length ? row.labels.join(", ") : "none";
  const metrics = [
    `Signal: ${labels}`,
  ];
  if (row.window && row.window !== "n/a") metrics.push(`Window: ${row.window}`);
  if (isFiniteNumber(row.price)) metrics.push(`Price: ${usd(row.price)}`);
  if (isFiniteNumber(row.oiChangePct)) metrics.push(`OI change: ${pct(row.oiChangePct)}`);
  if (isFiniteNumber(row.priceChangePct)) metrics.push(`Price change: ${pct(row.priceChangePct)}`);
  if (isFiniteNumber(row.oiMc)) metrics.push(`OI/MC: ${Number(row.oiMc).toFixed(2)}`);
  if (isFiniteNumber(row.openInterest)) metrics.push(`OI value: ${usd(row.openInterest)}`);
  if (isFiniteNumber(row.marketCap)) metrics.push(`MC: ${usd(row.marketCap)}`);
  if (isFiniteNumber(row.volume24h)) metrics.push(`Volume 24h: ${usd(row.volume24h)}`);
  if (isFiniteNumber(row.fundingRate)) metrics.push(`Funding: ${pct(row.fundingRate)}`);

  return {
    text: [
      `Монета: ${row.pair}`,
      "",
      metrics.join("\n"),
      "",
      `Reason: ${oneLine(row.reason)}`,
      `Next check: ${oneLine(row.nextCheck)}`,
    ].join("\n"),
    reply_markup: backKeyboard([], backAction, "К списку"),
  };
}

export function renderTelegramView(report, action = ACTIONS.main) {
  if (action === ACTIONS.refresh || action === ACTIONS.main) {
    return renderMain(report);
  }

  if (action === ACTIONS.setups) {
    return renderList(report, "setupCandidates", "Сетапы", "setup");
  }

  if (action === ACTIONS.oiChange) {
    return renderList(report, "topOiChange", "Top OI Change", "oi");
  }

  if (action === ACTIONS.priceChange) {
    return renderList(report, "topPriceChange", "Top Price Change", "price");
  }

  if (action === ACTIONS.oiMc) {
    return renderList(report, "topOiMcCandidates", "Top OI/MC", "oimc");
  }

  const [prefix, rawIndex] = action.split(":");
  const index = Number(rawIndex);
  if (prefix === "setup" && Number.isInteger(index)) {
    return renderDetails(report, "setupCandidates", index, ACTIONS.setups);
  }
  if (prefix === "oi" && Number.isInteger(index)) {
    return renderDetails(report, "topOiChange", index, ACTIONS.oiChange);
  }
  if (prefix === "price" && Number.isInteger(index)) {
    return renderDetails(report, "topPriceChange", index, ACTIONS.priceChange);
  }
  if (prefix === "oimc" && Number.isInteger(index)) {
    return renderDetails(report, "topOiMcCandidates", index, ACTIONS.oiMc);
  }

  return renderMain(report);
}
