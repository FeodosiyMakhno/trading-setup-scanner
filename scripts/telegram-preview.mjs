import { readLatestReport } from "../src/telegram/report.mjs";
import { ACTIONS, renderTelegramView } from "../src/telegram/views.mjs";

const report = await readLatestReport();
const actions = [
  ACTIONS.main,
  ACTIONS.setups,
  "setup:0",
  ACTIONS.oiChange,
  ACTIONS.priceChange,
  ACTIONS.oiMc,
];

for (const action of actions) {
  const view = renderTelegramView(report, action);
  console.log(`\n=== ${action} ===\n`);
  console.log(view.text);
  console.log("\nButtons:");
  for (const row of view.reply_markup.inline_keyboard) {
    console.log(row.map((item) => `[${item.text} -> ${item.callback_data}]`).join(" "));
  }
}
