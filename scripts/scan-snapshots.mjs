import { CONFIG } from "../src/config.mjs";
import { usd, pct } from "../src/format.mjs";
import { scanSnapshotRecords } from "../src/scanner/rules.mjs";
import { readJsonLines } from "../src/storage/jsonl.mjs";

const records = await readJsonLines(CONFIG.snapshotsFile);
const setups = scanSnapshotRecords(records, {
  lookbackMinutes: CONFIG.scanLookbackMinutes,
});

console.log(`Snapshots read: ${records.length}`);
console.log(`Lookback: ${CONFIG.scanLookbackMinutes} minutes`);
console.log(`Setup candidates found: ${setups.length}`);
console.log("");

if (records.length > 0 && setups.length === 0) {
  console.log("No setup candidates yet.");
  console.log("Tip: collect snapshots over time, for example every 5 minutes, then run scan again.");
  console.log("");
}

for (const [index, setup] of setups.slice(0, 25).entries()) {
  console.log(
    `${String(index + 1).padStart(2, " ")}. ${setup.exchangeSymbol.padEnd(14)} ` +
      `${setup.labels.join(", ").padEnd(18)} | ` +
      `OI/MC ${setup.oiMc.toFixed(2).padStart(6)} | ` +
      `OI ${pct(setup.oiChangePct).padStart(8)} | ` +
      `Price ${pct(setup.priceChangePct).padStart(8)} | ` +
      `MC ${usd(setup.marketCap).padStart(9)} | ` +
      `Funding ${pct(setup.fundingRate).padStart(8)}`
  );
}
