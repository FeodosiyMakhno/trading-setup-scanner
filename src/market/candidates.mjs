import { CONFIG } from "../config.mjs";

export function buildCandidates(bybitTickers, coinGeckoBySymbol, limit = CONFIG.candidateLimit) {
  return bybitTickers
    .map((ticker) => {
      const coin = coinGeckoBySymbol.get(ticker.symbol);
      const marketCap = Number(coin?.market_cap);
      const fdv = Number(coin?.fully_diluted_valuation);
      const oiMc = marketCap > 0 ? ticker.openInterest / marketCap : null;

      return {
        ...ticker,
        coingeckoId: coin?.id ?? null,
        name: coin?.name ?? ticker.symbol,
        marketCap,
        fdv,
        oiMc,
      };
    })
    .filter((item) => item.coingeckoId && Number.isFinite(item.oiMc))
    .filter((item) => item.marketCap > 0 && item.marketCap <= CONFIG.marketCapMax)
    .filter((item) => item.volume24h >= CONFIG.volume24hMin)
    .sort((a, b) => b.oiMc - a.oiMc)
    .slice(0, limit);
}
