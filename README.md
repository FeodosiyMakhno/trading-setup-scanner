# Trading Setup Scanner

Telegram-first scanner for trading setup candidates based on open interest, price action, volume, market cap, and funding.

The goal is not to generate buy/sell signals. The scanner should find situations worth checking manually, then track whether setup rules can reach a positive expectancy, for example RR 1:2 with 34%+ winrate.

## MVP Focus

First strategy: **OI + Price Action**.

Initial patterns:

- **OI/MC anomaly**: open interest is high relative to market cap.
- **Silent OI build**: OI grows quickly while price barely moves.
- **Price without OI**: price pumps while OI does not confirm the move.

## Free Data Prototype

The prototype uses public data only:

- Bybit public futures market data for USDT perpetual tickers, OI, funding, and price.
- CoinGecko public market data for market cap, FDV, price, and volume.

No API keys are required for the first scripts.

## Requirements

- Node.js 20+
- Git, only if you want to clone and update the repo locally.

## Install

```bash
git clone https://github.com/FeodosiyMakhno/trading-setup-scanner.git
cd trading-setup-scanner
npm install
```

There are currently no external npm dependencies. `npm install` just prepares the local project normally.

## Commands

### One-time data feasibility check

```bash
npm run check
```

This prints the current Bybit/CoinGecko data match, top OI/MC candidates, and direct 1h enrichment for the top candidates.

### Collect a market snapshot

```bash
npm run collect
```

This writes the current candidate market state to:

```text
data/market-snapshots.jsonl
```

The file is ignored by git because it is local runtime data.

### Scan collected snapshots

```bash
npm run scan
```

This reads local snapshots and searches for MVP setup candidates using strict thresholds.

For meaningful 1h signals, collect snapshots over time, for example every 5 minutes, then run `npm run scan`.

### Test mode scan

```bash
npm run scan:test
```

Test mode uses softer thresholds so early reports are not empty while we tune the scanner. It is for observation, not final signal quality.

Current test mode includes `OI/MC watch` when OI/MC is at least `0.25`.

### Generate visual HTML report

```bash
npm run report
```

This creates:

```text
reports/latest-report.html
```

Open this file in a browser to see summary cards, setup candidates, and a visual top OI/MC table.

For softer test-mode report:

```bash
npm run report:test
```

### Collect automatically

```bash
npm run collect:loop
```

By default this runs 12 collections with a 5-minute interval, about 1 hour total. After every collection it runs `npm run scan`.

For a short test on Windows PowerShell:

```powershell
$env:COLLECT_RUNS="1"
$env:COLLECT_INTERVAL_MINUTES="0"
npm run collect:loop
```

For a one-hour test-mode run with an HTML report after every collection:

```powershell
$env:SCAN_MODE="test"
$env:COLLECT_GENERATE_REPORT="1"
npm run collect:loop
```

For continuous mode:

```powershell
$env:COLLECT_RUNS="0"
npm run collect:loop
```

Use continuous mode only when you are ready to leave the process running.

## Useful Environment Options

```bash
SCAN_MARKET_CAP_MAX=500000000
SCAN_VOLUME_24H_MIN=1000000
SCAN_CANDIDATE_LIMIT=100
SCAN_MODE=strict
SCAN_LOOKBACK_MINUTES=60
SNAPSHOTS_FILE=data/market-snapshots.jsonl
COINGECKO_CACHE_FILE=data/coingecko-markets-cache.json
COINGECKO_CACHE_TTL_MINUTES=60
COLLECT_INTERVAL_MINUTES=5
COLLECT_RUNS=12
COLLECT_GENERATE_REPORT=0
```

On Windows PowerShell, set a variable like this before running a command:

```powershell
$env:SCAN_CANDIDATE_LIMIT="50"
npm run collect
```

## Current MVP Modules

- `src/providers`: Bybit and CoinGecko data providers.
- `src/market`: candidate matching and OI/MC ranking.
- `src/storage`: local JSONL snapshot storage.
- `src/scanner`: setup rules.
- `scripts`: runnable prototype commands.

## Planned Next Steps

- Add duplicate protection for repeated setup candidates.
- Add Telegram bot interface.
- Add manual setup tracking: direction, entry, SL, TP, RR.
- Add winrate, RR, and expectancy stats.

## Safety

This project is an analytical scanner, not financial advice and not an automated trading system. Any setup candidate must be checked manually before action.
