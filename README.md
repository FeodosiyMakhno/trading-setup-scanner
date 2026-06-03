# Trading Setup Scanner

Telegram-first scanner for trading setup candidates based on open interest, price action, volume, market cap, and funding.

The goal is not to generate buy/sell signals. The scanner should find situations worth checking manually, then track whether setup rules can reach a positive expectancy, for example RR 1:2 with 34%+ winrate.

## MVP Focus

First strategy: **OI + Price Action**.

Initial patterns:

- **OI/MC anomaly**: open interest is high relative to market cap.
- **Silent OI build**: OI grows quickly while price barely moves.
- **Price without OI**: price pumps while OI does not confirm the move.

## Free Data Test

The first prototype uses public data only:

- Bybit public futures market data for USDT perpetual tickers, OI, funding, and candles.
- CoinGecko public market data for market cap, FDV, price, and volume.

This is intentionally a data feasibility test before building the full Telegram bot.

## Requirements

- Node.js 20+

No API keys are required for the first check script.

## Run

```bash
npm install
npm run check
```

The script prints:

- number of Bybit USDT perpetual tickers found;
- number of CoinGecko symbols indexed;
- top OI/MC candidates under the configured market cap;
- basic 1h OI/price enrichment for top candidates;
- MVP signal candidates if current market conditions match the first rules.

## Planned MVP Modules

- `collectors`: Bybit and CoinGecko data collection.
- `scanner`: setup rules and duplicate protection.
- `storage`: market snapshots and setup history.
- `bot`: Telegram interface.
- `tracker`: TP/SL tracking for manually accepted setups.
- `stats`: winrate, RR, and expectancy.

## Safety

This project is an analytical scanner, not financial advice and not an automated trading system. Any setup candidate must be checked manually before action.
