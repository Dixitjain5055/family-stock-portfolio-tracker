import "server-only";
import type { HoldingLot, MarketQuote } from "@/types/portfolio";
import { getQuotes } from "./yahoo";
import { getSgbQuotes } from "./bse";
import { getPhysicalGoldQuotes } from "./gold";
import { canonicalTicker, effectiveAssetType } from "@/lib/portfolio/assets";

const AMFI_NAV_URL = "https://www.amfiindia.com/spages/NAVAll.txt";
const CACHE_TTL_MS = 30 * 60 * 1000;

type AmfiRecord = {
  schemeCode: string;
  isinPayout: string;
  isinReinvestment: string;
  schemeName: string;
  nav: number;
  navDate: string;
};

let navCache: { expires: number; byIdentifier: Map<string, AmfiRecord> } | null = null;

function normalizeIdentifier(value: string) {
  return value.trim().toUpperCase();
}

function parseAmfiDate(value: string) {
  const match = value.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return null;
  const month = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
    .indexOf(match[2].toUpperCase());
  if (month < 0) return null;
  return new Date(Date.UTC(Number(match[3]), month, Number(match[1]), 18, 30)).toISOString();
}

function parseAmfiReport(report: string) {
  const byIdentifier = new Map<string, AmfiRecord>();
  for (const rawLine of report.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const cells = rawLine.split(";").map((cell) => cell.trim());
    if (cells.length < 6 || !/^\d+$/.test(cells[0])) continue;
    const nav = Number(cells[4]);
    const navDate = parseAmfiDate(cells[5]);
    if (!(nav > 0) || !navDate) continue;
    const record: AmfiRecord = {
      schemeCode: cells[0],
      isinPayout: normalizeIdentifier(cells[1]),
      isinReinvestment: normalizeIdentifier(cells[2]),
      schemeName: cells[3],
      nav,
      navDate,
    };
    for (const identifier of [record.schemeCode, record.isinPayout, record.isinReinvestment]) {
      if (identifier) byIdentifier.set(normalizeIdentifier(identifier), record);
    }
  }
  return byIdentifier;
}

async function loadAmfiNav() {
  if (navCache && navCache.expires > Date.now()) return navCache.byIdentifier;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(AMFI_NAV_URL, {
      cache: "no-store",
      headers: { accept: "text/plain" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`AMFI NAV returned HTTP ${response.status}`);
    const byIdentifier = parseAmfiReport(await response.text());
    if (!byIdentifier.size) throw new Error("AMFI NAV report was empty");
    navCache = { expires: Date.now() + CACHE_TTL_MS, byIdentifier };
    return byIdentifier;
  } finally {
    clearTimeout(timer);
  }
}

export async function getAmfiMutualFundQuotes(rawIdentifiers: string[]): Promise<MarketQuote[]> {
  const identifiers = [...new Set(rawIdentifiers.map(normalizeIdentifier).filter(Boolean))].slice(0, 200);
  if (!identifiers.length) return [];
  let report: Map<string, AmfiRecord>;
  try {
    report = await loadAmfiNav();
  } catch (error) {
    const message = error instanceof Error ? error.message : "AMFI NAV unavailable";
    return identifiers.map((ticker) => ({
      ticker,
      price: null,
      previousClose: null,
      change: null,
      changePercent: null,
      currency: "INR",
      marketTime: null,
      sector: "Mutual funds",
      marketCap: null,
      stale: true,
      instrumentType: "MUTUALFUND",
      error: message,
    }));
  }

  return identifiers.map((ticker) => {
    const record = report.get(ticker);
    if (!record) {
      return {
        ticker,
        price: null,
        previousClose: null,
        change: null,
        changePercent: null,
        currency: "INR",
        marketTime: null,
        sector: "Mutual funds",
        marketCap: null,
        stale: true,
        instrumentType: "MUTUALFUND",
        error: "No current AMFI NAV matched this scheme code or ISIN",
      };
    }
    const ageMs = Date.now() - new Date(record.navDate).getTime();
    return {
      ticker,
      price: record.nav,
      previousClose: null,
      change: null,
      changePercent: null,
      currency: "INR",
      marketTime: record.navDate,
      sector: "Mutual funds",
      marketCap: null,
      stale: ageMs > 5 * 24 * 60 * 60 * 1000,
      instrumentType: "MUTUALFUND",
    };
  });
}

export async function getMutualFundMarketQuotes(rawIdentifiers: string[]) {
  const identifiers = [...new Set(rawIdentifiers.map(normalizeIdentifier).filter(Boolean))];
  const amfiIdentifiers = identifiers.filter((identifier) => /^\d+$|^INF[A-Z0-9]{9}$/.test(identifier));
  const yahooIdentifiers = identifiers.filter((identifier) => !amfiIdentifiers.includes(identifier));
  const [amfiQuotes, yahooQuotes] = await Promise.all([
    getAmfiMutualFundQuotes(amfiIdentifiers),
    getQuotes(yahooIdentifiers),
  ]);
  return [...amfiQuotes, ...yahooQuotes];
}

export async function getPortfolioMarketQuotes(lots: HoldingLot[]) {
  const stockTickers = lots.filter((lot) => effectiveAssetType(lot) === "stock")
    .map((lot) => canonicalTicker(lot.ticker, "stock"));
  const fundIdentifiers = lots.filter((lot) => lot.asset_type === "mutual_fund").map((lot) => lot.ticker);
  const sgbTickers = lots.filter((lot) => effectiveAssetType(lot) === "sgb")
    .map((lot) => canonicalTicker(lot.ticker, "sgb"));
  const goldTickers = lots.filter((lot) => effectiveAssetType(lot) === "gold")
    .map((lot) => canonicalTicker(lot.ticker, "gold"));
  const [stocks, funds, sgb, gold] = await Promise.all([
    getQuotes(stockTickers),
    getMutualFundMarketQuotes(fundIdentifiers),
    getSgbQuotes(sgbTickers),
    getPhysicalGoldQuotes(goldTickers),
  ]);
  return [...stocks, ...funds, ...sgb, ...gold];
}
