import { describe, expect, it } from "vitest";
import { lotSchema, sellSchema } from "./portfolio";

const baseLot = {
  memberId: "10000000-0000-4000-8000-000000000001",
  ticker: "RELIANCE.NS",
  assetType: "stock",
  exchange: "NSE",
  quantity: 10,
  buyPrice: 2500,
  source: "excel",
};

describe("portfolio validation", () => {
  it("accepts a holding without an acquisition date", () => {
    const result = lotSchema.parse(baseLot);
    expect(result.buyDate).toBeNull();
  });

  it("requires an explicit tax term for a sale", () => {
    const sale = {
      memberId: baseLot.memberId,
      holdingId: "20000000-0000-4000-8000-000000000001",
      quantity: 2,
      sellPrice: 2800,
      sellDate: "2026-07-23",
      fees: 10,
    };
    expect(sellSchema.safeParse(sale).success).toBe(false);
    expect(sellSchema.parse({ ...sale, taxTag: "Long-Term" }).taxTag).toBe("Long-Term");
  });
});
