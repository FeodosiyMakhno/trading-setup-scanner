import { loadEnvFile } from "../src/runtime/env.mjs";
import { TelegramApi } from "../src/telegram/api.mjs";
import { rememberTelegramChat } from "../src/telegram/chats.mjs";
import { readLatestReport } from "../src/telegram/report.mjs";
import { ACTIONS, renderTelegramView } from "../src/telegram/views.mjs";

await loadEnvFile();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Set TELEGRAM_BOT_TOKEN in .env or environment before running npm run bot.");
  process.exit(1);
}

const api = new TelegramApi(token);
const pollingTimeoutSeconds = Number(process.env.TELEGRAM_POLL_TIMEOUT_SECONDS ?? 30);
let offset = Number(process.env.TELEGRAM_UPDATE_OFFSET ?? 0);
let stopped = false;

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

const me = await api.getMe();
console.log(`Telegram bot started: @${me.username ?? me.first_name}`);

while (!stopped) {
  try {
    const updates = await api.getUpdates({
      offset,
      timeout: pollingTimeoutSeconds,
      allowed_updates: ["message", "callback_query"],
    });

    for (const update of updates) {
      offset = update.update_id + 1;
      await handleUpdate(update);
    }
  } catch (error) {
    console.error(error.message);
    await sleep(2_000);
  }
}

console.log("Telegram bot stopped.");

function stop() {
  stopped = true;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadView(action = ACTIONS.main) {
  try {
    const report = await readLatestReport();
    return renderTelegramView(report, action);
  } catch (error) {
    return {
      text: [
        "Отчет пока недоступен.",
        "",
        `Причина: ${error.message}`,
        "",
        "Сначала запусти сбор и генерацию отчета:",
        "npm run collect",
        "npm run report:test",
      ].join("\n"),
      reply_markup: {
        inline_keyboard: [[{ text: "Обновить", callback_data: ACTIONS.refresh }]],
      },
    };
  }
}

async function handleUpdate(update) {
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }

  if (update.message) {
    await handleMessage(update.message);
  }
}

async function handleMessage(message) {
  const chatId = message.chat?.id;
  if (!chatId) return;
  await rememberTelegramChat(message.chat);

  const view = await loadView(ACTIONS.main);
  await api.sendMessage({
    chat_id: chatId,
    text: view.text,
    reply_markup: view.reply_markup,
  });
}

async function handleCallbackQuery(query) {
  const action = query.data ?? ACTIONS.main;
  const message = query.message;
  const chatId = message?.chat?.id;
  const messageId = message?.message_id;

  await api.answerCallbackQuery({ callback_query_id: query.id });

  if (!chatId || !messageId) return;
  await rememberTelegramChat(message.chat);

  const view = await loadView(action);
  try {
    await api.editMessageText({
      chat_id: chatId,
      message_id: messageId,
      text: view.text,
      reply_markup: view.reply_markup,
    });
  } catch (error) {
    if (!error.message.includes("message is not modified")) throw error;
  }
}
