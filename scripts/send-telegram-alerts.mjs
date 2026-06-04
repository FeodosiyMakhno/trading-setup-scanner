import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnvFile } from "../src/runtime/env.mjs";
import { appendJsonLines, readJsonLines } from "../src/storage/jsonl.mjs";
import { TelegramApi } from "../src/telegram/api.mjs";
import { buildTelegramAlerts, defaultTelegramAlertsSentFile } from "../src/telegram/alerts.mjs";
import { readTelegramChats } from "../src/telegram/chats.mjs";

await loadEnvFile();

const reportFile = resolve(process.env.REPORT_JSON_FILE ?? "reports/latest-report.json");
const sentFile = resolve(process.env.TELEGRAM_ALERTS_SENT_FILE ?? defaultTelegramAlertsSentFile);
const chats = await readTelegramChats();

if (!chats.length) {
  console.log("No Telegram chats registered yet. Send /start to the bot first.");
  process.exit(0);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Set TELEGRAM_BOT_TOKEN before sending Telegram alerts.");
  process.exit(1);
}

const report = JSON.parse(await readFile(reportFile, "utf8"));
const alerts = buildTelegramAlerts(report);
const sentRows = await readJsonLines(sentFile);
const sentKeys = new Set(sentRows.map((row) => row.key));
const pendingAlerts = alerts.filter((alert) => !sentKeys.has(alert.key));

if (!pendingAlerts.length) {
  console.log("No new Telegram alerts.");
  process.exit(0);
}

const api = new TelegramApi(token);
const delivered = [];

for (const alert of pendingAlerts) {
  for (const chat of chats) {
    await api.sendMessage({
      chat_id: chat.id,
      text: alert.text,
      reply_markup: {
        inline_keyboard: [[{ text: "Открыть меню", callback_data: "main" }]],
      },
    });
  }

  delivered.push({
    key: alert.key,
    pair: alert.pair,
    chatCount: chats.length,
    sentAt: new Date().toISOString(),
  });
}

await appendJsonLines(sentFile, delivered);

console.log(`Telegram chats: ${chats.length}`);
console.log(`Alerts sent: ${delivered.length}`);
for (const item of delivered) {
  console.log(`${item.pair}: ${item.key}`);
}
