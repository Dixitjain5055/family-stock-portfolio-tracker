import type { AggregatedHolding, HoldingLot, MarketQuote, PortfolioSummary } from "@/types/portfolio";
import { canonicalTicker, effectiveAssetType } from "./assets";

const number = (value: unknown) => Number(value ?? 0);

export function weightedAverage(
  rows: Array<{ quantity: number; price: number }>,
): number {
  const quantity = rows.reduce((sum, row) => sum + number(row.quantity), 0);
  if (quantity <= 0) return 0;
  return rows.reduce((sum, row) => sum + number(row.quantity) * number(row.price), 0) / quantity;
}

export function aggregateLots(
  lots: HoldingLot[],
  quotes: MarketQuote[] = [],
): AggregatedHolding[] {
  const quoteMap = new Map(quotes.map((quote) => [quote.ticker.toUpperCase(), quote]));
  const tickerGroups = new Map<string, HoldingLot[]>();

  for (const lot of lots.filter((item) => number(item.remaining_quantity) > 0)) {
    const assetType = effectiveAssetType(lot);
    const key = `${assetType}:${canonicalTicker(lot.ticker, assetType)}`;
    tickerGroups.set(key, [...(tickerGroups.get(key) ?? []), lot]);
  }

  return [...tickerGroups.values()].map((tickerLots) => {
    const assetType = effectiveAssetType(tickerLots[0]);
    const ticker = canonicalTicker(tickerLots[0].ticker, assetType);
    const ownersMap = new Map<string, HoldingLot[]>();
    for (const lot of tickerLots) {
      ownersMap.set(lot.member_id, [...(ownersMap.get(lot.member_id) ?? []), lot]);
    }
    const quantity = tickerLots.reduce((sum, lot) => sum + number(lot.remaining_quantity), 0);
    const invested = tickerLots.reduce(
      (sum, lot) => sum + number(lot.remaining_quantity) * number(lot.adjusted_buy_price ?? lot.buy_price),
      0,
    );
    const quote = quoteMap.get(ticker) ?? null;
    const valuationFallback = quote?.price == null;
    const currentValue = valuationFallback ? invested : quote.price! * quantity;
    const unrealizedPl = currentValue - invested;
    const dayChange = quote?.change == null ? null : quote.change * quantity;

    return {
      ticker,
      assetType,
      exchange: tickerLots[0].exchange,
      companyName: tickerLots[0].company_name || ticker,
      quantity,
      averagePrice: quantity ? invested / quantity : 0,
      invested,
      currentPrice: quote?.price ?? null,
      currentValue,
      unrealizedPl,
      unrealizedPlPercent: unrealizedPl == null || invested === 0 ? null : (unrealizedPl / invested) * 100,
      dayChange,
      dayChangePercent: quote?.changePercent ?? null,
      valuationFallback,
      quote,
      owners: [...ownersMap.entries()].map(([memberId, memberLots]) => {
        const memberQuantity = memberLots.reduce((sum, lot) => sum + number(lot.remaining_quantity), 0);
        const memberInvested = memberLots.reduce(
          (sum, lot) => sum + number(lot.remaining_quantity) * number(lot.adjusted_buy_price ?? lot.buy_price),
          0,
        );
        return {
          memberId,
          memberName: memberLots[0].family_members?.name ?? "Member",
          quantity: memberQuantity,
          averagePrice: memberQuantity ? memberInvested / memberQuantity : 0,
          invested: memberInvested,
          brokers: [...new Set(memberLots.map((lot) => lot.broker).filter((v): v is string => Boolean(v)))],
          lots: memberLots,
        };
      }),
    };
  }).sort((a, b) => (b.currentValue ?? b.invested) - (a.currentValue ?? a.invested));
}

export function summarizePortfolio(
  holdings: AggregatedHolding[],
  realizedPl = 0,
): PortfolioSummary {
  const totalInvested = holdings.reduce((sum, row) => sum + row.invested, 0);
  const complete = holdings.every((row) => !row.valuationFallback);
  const totalValue = holdings.reduce((sum, row) => sum + (row.currentValue ?? row.invested), 0);
  const dayRows = holdings.filter((row) => row.dayChange != null && row.currentValue != null);
  const dayChange = dayRows.length
    ? dayRows.reduce((sum, row) => sum + (row.dayChange ?? 0), 0)
    : null;
  const coveredCurrentValue = dayRows.reduce((sum, row) => sum + (row.currentValue ?? 0), 0);
  const previousValue = dayChange == null ? null : coveredCurrentValue - dayChange;
  const unrealizedPl = totalValue == null ? null : totalValue - totalInvested;

  return {
    holdings,
    totalValue,
    totalInvested,
    unrealizedPl,
    unrealizedPlPercent: unrealizedPl == null || !totalInvested ? null : (unrealizedPl / totalInvested) * 100,
    dayChange,
    dayChangePercent: dayChange == null || !previousValue ? null : (dayChange / previousValue) * 100,
    dayChangeCoverage: holdings.length ? (dayRows.length / holdings.length) * 100 : 0,
    realizedPl,
    lastRefresh: holdings.find((row) => row.quote?.marketTime)?.quote?.marketTime ?? null,
    partialMarketData: !complete,
  };
}
