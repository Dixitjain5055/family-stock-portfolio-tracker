import { describe, expect, it } from "vitest";
import { normalizeImportDate, parseImportNumber, parseTabularSheets } from "./portfolio-parser";

function preamble(title: string) {
  return [
    [title],
    ["Generated for portfolio review"],
    ...Array.from({ length: 20 }, () => []),
  ];
}

describe("portfolio import parser", () => {
  it("finds a broker holdings table after summary rows", () => {
    const result = parseTabularSheets([{
      name: "Equity",
      rows: [
        ...preamble("Holdings statement as on 2026-07-21"),
        ["Symbol", "ISIN", "Sector", "Quantity Available", "Average Price", "Previous Closing Price"],
        ["AVALON", "INE0LCL01028", "Industrials", "10", "1,234.50", "1350"],
        ["CUB", "INE491A01021", "Financials", "25", "₹198.40", "210"],
      ],
    }]);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].rowNumber).toBe(24);
    expect(result.rows[0].detectedAssetType).toBe("stock");
    expect(result.rows[0].values["Ticker / Scheme Code"]).toBe("AVALON.NS");
    expect(result.rows[0].values["Average Price"]).toBe("1234.5");
    expect(result.statementDate).toBe("2026-07-21");
    expect(result.requiresFallbackDate).toBe(false);
  });

  it("combines dedicated equity and mutual-fund sheets without reimporting Combined", () => {
    const header = ["Symbol", "ISIN", "Instrument Type", "Quantity Available", "Average Price"];
    const equityHeader = ["Symbol", "ISIN", "Sector", "Quantity Available", "Average Price"];
    const equityRow = ["FEDERALBNK", "INE171A01029", "Financials", "12", "185.50"];
    const fundRow = [
      "PARAG PARIKH FLEXI CAP FUND - DIRECT PLAN",
      "INF879O01027",
      "Mutual Fund",
      "42.125",
      "91.25",
    ];
    const result = parseTabularSheets([
      { name: "Equity", rows: [equityHeader, equityRow] },
      { name: "Mutual Funds", rows: [header, fundRow] },
      { name: "Combined", rows: [header, equityRow, fundRow] },
    ]);

    expect(result.rows).toHaveLength(2);
    expect(result.detectedSheets).toEqual(["Equity", "Mutual Funds"]);
    expect(result.mixedAssetTypes).toBe(true);
    expect(result.rows[1].detectedAssetType).toBe("mutual_fund");
    expect(result.rows[1].values["Ticker / Scheme Code"]).toBe("INF879O01027");
    expect(result.rows[1].values["Company / Scheme Name"]).toContain("PARAG PARIKH");
    expect(result.warnings.some((warning) => warning.includes("AMFI"))).toBe(true);
  });

  it("normalizes common spreadsheet numbers and dates", () => {
    expect(parseImportNumber("₹1,23,456.75")).toBe(123456.75);
    expect(parseImportNumber("(1,250.50)")).toBe(-1250.5);
    expect(normalizeImportDate("21/07/2026")).toBe("2026-07-21");
    expect(normalizeImportDate("2026/07/21")).toBe("2026-07-21");
    expect(normalizeImportDate("46200")).toBe("2026-06-27");
  });

  it("uses an explicit purchase date when present", () => {
    const result = parseTabularSheets([{
      name: "Transactions",
      rows: [
        ["Ticker", "Qty", "Avg Price", "Trade Date", "Broker", "Exchange"],
        ["MSFT", "3", "420.25", "2025-01-02", "Demo Broker", "NASDAQ"],
      ],
    }]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].values["Buy Date"]).toBe("2025-01-02");
    expect(result.requiresFallbackDate).toBe(false);
  });

  it("recognizes alternate broker cost and CMP headers", () => {
    const result = parseTabularSheets([{
      name: "Equity Holdings",
      rows: [
        ["Portfolio valuation"],
        ["Scrip Name", "Qty.", "Avg. Cost Price (INR)", "CMP (Rs.)"],
        ["SBIN", "15", "812.40", "835.75"],
      ],
    }]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].values["Ticker / Scheme Code"]).toBe("SBIN.NS");
    expect(result.rows[0].values["Average Price"]).toBe("812.4");
    expect(result.rows[0].values["Statement CMP"]).toBe("835.75");
  });

  it("does not mistake NSE tickers beginning with IN for an ISIN", () => {
    const result = parseTabularSheets([{
      name: "Equity",
      rows: [
        ["Symbol", "Quantity", "Average Price"],
        ["INDHOTEL", "10", "720"],
        ["INDUSINDBK", "12", "855"],
      ],
    }]);
    expect(result.rows.map((row) => row.values["Ticker / Scheme Code"]))
      .toEqual(["INDHOTEL.NS", "INDUSINDBK.NS"]);
  });

  it("removes broker suffixes from ETFs and recognizes sovereign gold bonds", () => {
    const result = parseTabularSheets([{
      name: "Equity",
      rows: [
        ["Symbol", "Instrument Type", "Quantity", "Average Price"],
        ["SILVERBEES-E", "ETF", "20", "98.5"],
        ["SGBFEB32IV-GB", "Sovereign Gold Bond", "3", "6350"],
      ],
    }]);
    expect(result.rows[0].values["Ticker / Scheme Code"]).toBe("SILVERBEES.NS");
    expect(result.rows[0].detectedAssetType).toBe("stock");
    expect(result.rows[1].values["Ticker / Scheme Code"]).toBe("SGBFEB32IV");
    expect(result.rows[1].detectedAssetType).toBe("sgb");
  });

  it("derives average cost from invested value but never substitutes CMP", () => {
    const derived = parseTabularSheets([{
      name: "Stocks",
      rows: [
        ["Trading Symbol", "Available Qty", "Invested Amount", "Current Market Price"],
        ["INFY", "20", "30000", "1650"],
      ],
    }]);
    expect(derived.rows[0].values["Average Price"]).toBe("1500");
    expect(derived.rows[0].values["Statement CMP"]).toBe("1650");

    const missingCost = parseTabularSheets([{
      name: "Stocks",
      rows: [
        ["Symbol", "Quantity", "LTP"],
        ["TCS", "5", "4100"],
      ],
    }]);
    expect(missingCost.rows).toHaveLength(1);
    expect(missingCost.rows[0].values["Average Price"]).toBe("");
    expect(missingCost.rows[0].values["Statement CMP"]).toBe("4100");
    expect(missingCost.warnings.some((warning) => warning.includes("never substituted"))).toBe(true);
  });
});
