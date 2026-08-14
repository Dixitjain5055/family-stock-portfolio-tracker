import { describe, expect, it } from "vitest";
import { sortAggregatedHoldings } from "./sorting";
import type { AggregatedHolding } from "@/types/portfolio";

function holding(name: string, quantity: number, value: number | null): AggregatedHolding {
  return {
    ticker: `${name.toUpperCase()}.NS`,
    assetType: "stock",
    exchange: "NSE",
    companyName: name,
    quantity,
    averagePrice: 100,
    invested: quantity * 100,
    currentPrice: value == null ? null : value / quantity,
    currentValue: value,
    unrealizedPl: value == null ? null : value - quantity * 100,
    unrealizedPlPercent: null,
    dayChange: null,
    dayChangePercent: null,
    valuationFallback: value == null,
    owners: [],
    quote: null,
  };
}

describe("holding sorting", () => {
  const rows = [holding("Zeta", 5, null), holding("Alpha", 20, 2400), holding("Beta", 10, 900)];

  it("toggles alphabetical ordering by investment name", () => {
    expect(sortAggregatedHoldings(rows, "name", "asc").map((row) => row.companyName))
      .toEqual(["Alpha", "Beta", "Zeta"]);
    expect(sortAggregatedHoldings(rows, "name", "desc").map((row) => row.companyName))
      .toEqual(["Zeta", "Beta", "Alpha"]);
  });

  it("sorts numeric columns and keeps unavailable values last", () => {
    expect(sortAggregatedHoldings(rows, "quantity", "desc").map((row) => row.quantity)).toEqual([20, 10, 5]);
    expect(sortAggregatedHoldings(rows, "invested", "desc").map((row) => row.invested)).toEqual([2000, 1000, 500]);
    expect(sortAggregatedHoldings(rows, "currentValue", "desc").map((row) => row.currentValue))
      .toEqual([2400, 900, null]);
  });
});
