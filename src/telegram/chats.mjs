import { resolve } from "node:path";
import { appendJsonLines, readJsonLines } from "../storage/jsonl.mjs";

export const defaultTelegramChatsFile = "data/telegram-chats.jsonl";

export async function rememberTelegramChat(chat, file = process.env.TELEGRAM_CHATS_FILE ?? defaultTelegramChatsFile) {
  if (!chat?.id) return false;

  const path = resolve(file);
  const chats = await readTelegramChats(path);
  if (chats.some((item) => item.id === chat.id)) return false;

  await appendJsonLines(path, [{
    id: chat.id,
    type: chat.type,
    username: chat.username,
    firstName: chat.first_name,
    lastName: chat.last_name,
    title: chat.title,
    addedAt: new Date().toISOString(),
  }]);
  return true;
}

export async function readTelegramChats(file = process.env.TELEGRAM_CHATS_FILE ?? defaultTelegramChatsFile) {
  const rows = await readJsonLines(resolve(file));
  const byId = new Map();

  for (const row of rows) {
    if (row?.id) byId.set(row.id, row);
  }

  return [...byId.values()];
}
