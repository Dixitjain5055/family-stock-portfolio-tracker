import type { AssetType, HoldingLot } from "@/types/portfolio";

export function effectiveAssetType(lot: Pick<HoldingLot, "asset_type" | "exchange" | "ticker">): AssetType {
  if (lot.asset_type !== "stock") return lot.asset_type;
  if (lot.exchange === "GOLD") return "gold";
  if (lot.exchange === "SGB" || /(?:^SGB|-GB(?:\.NS)?$)/i.test(lot.ticker)) return "sgb";
  return "stock";
}

export function canonicalTicker(ticker: string, assetType: AssetType) {
  const normalized = ticker.trim().toUpperCase().replace(/\s+/g, "");
  if (assetType === "sgb") return normalized.replace(/-GB(?:\.NS)?$/, "").replace(/\.NS$/, "");
  if (assetType === "gold") {
    if (/^(?:GOLD-?)?(?:22K|916)$/.test(normalized)) return "GOLD-22K";
    if (/^(?:GOLD-?)?(?:18K|750)$/.test(normalized)) return "GOLD-18K";
    return "GOLD-24K";
  }
  if (assetType === "stock") return normalized.replace(/-E(?=\.NS$|$)/, "");
  return normalized;
}

export function assetTypeLabel(assetType: AssetType) {
  if (assetType === "mutual_fund") return "Mutual fund";
  if (assetType === "sgb") return "Sovereign gold bond";
  if (assetType === "gold") return "Physical gold";
  return "Stock / ETF";
}
