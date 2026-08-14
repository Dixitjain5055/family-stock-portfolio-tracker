import type { AggregatedHolding } from "@/types/portfolio";

export type HoldingSortKey =
  | "name"
  | "owners"
  | "broker"
  | "quantity"
  | "averagePrice"
  | "currentPrice"
  | "invested"
  | "currentValue"
  | "unrealizedPl"
  | "dayChange";

export type SortDirection = "asc" | "desc";

function sortValue(row: AggregatedHolding, key: HoldingSortKey) {
  if (key === "name") return `${row.companyName} ${row.ticker}`;
  if (key === "owners") return row.owners.length;
  if (key === "broker") return [...new Set(row.owners.flatMap((owner) => owner.brokers))].join(", ");
  return row[key];
}

export function sortAggregatedHoldings(
  holdings: AggregatedHolding[],
  key: HoldingSortKey,
  direction: SortDirection,
) {
  return [...holdings].sort((left, right) => {
    const leftValue = sortValue(left, key);
    const rightValue = sortValue(right, key);
    if (leftValue == null && rightValue == null) return 0;
    if (leftValue == null) return 1;
    if (rightValue == null) return -1;
    const comparison = typeof leftValue === "number" && typeof rightValue === "number"
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue), "en-IN", { numeric: true, sensitivity: "base" });
    return direction === "asc" ? comparison : -comparison;
  });
}
