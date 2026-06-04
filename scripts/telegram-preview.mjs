import { readLatestEvaluation } from "../src/telegram/evaluation.mjs";
import { readLatestReport } from "../src/telegram/report.mjs";
import { ACTIONS, renderTelegramView } from "../src/telegram/views.mjs";

const report = await readLatestReport();
const evaluation = await readLatestEvaluation().catch(() => null);
const actions = [
  ACTIONS.main,
  ACTIONS.setups,
  "setup:0",
  ACTIONS.oiChange,
  ACTIONS.priceChange,
  ACTIONS.oiMc,
  ACTIONS.stats,
];

for (const action of actions) {
  const view = renderTelegramView(report, action, { evaluation });
  console.log(`\n=== ${action} ===\n`);
  console.log(view.text);
  console.log("\nButtons:");
  for (const row of view.reply_markup.inline_keyboard) {
    console.log(row.map((item) => `[${item.text} -> ${item.callback_data}]`).join(" "));
  }
}
