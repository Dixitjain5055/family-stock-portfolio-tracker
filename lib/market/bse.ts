import "server-only";
import type { MarketQuote } from "@/types/portfolio";

const BSE_API = "https://api.bseindia.com/BseIndiaAPI/api";
const HEADERS = {
  accept: "application/json",
  referer: "https://www.bseindia.com/",
  "user-agent": "Mozilla/5.0 (compatible; Kinfolio/1.0; +portfolio-tracker)",
};

type BseSecurity = { SCRIP_CD?: string; scrip_id?: string; Scrip_Name?: string };
type BseHeader = {
  CurrRate?: { LTP?: string; Chg?: string; PcChg?: string };
  Header?: { PrevClose?: string; Ason?: string };
  Cmpname?: { FullN?: string };
};

let securityCache: { expires: number; values: Map<string, BseSecurity> } | null = null;
const quoteCache = new Map<string, { expires: number; quote: MarketQuote }>();

function number(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeSgbTicker(value: string) {
  return value.trim().toUpperCase().replace(/-GB(?:\.NS)?$/, "").replace(/\.NS$/, "");
}

async function loadSgbSecurityMap() {
  if (securityCache && securityCache.expires > Date.now()) return securityCache.values;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const url = `${BSE_API}/ListofScripData/w?scripcode=&Group=G&industry=&segment=Debt&status=Active`;
    const response = await fetch(url, { headers: HEADERS, cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`BSE security list returned HTTP ${response.status}`);
    const rows = await response.json() as BseSecurity[];
    const values = new Map<string, BseSecurity>();
    for (const row of rows) if (row.scrip_id && row.SCRIP_CD) values.set(row.scrip_id.toUpperCase(), row);
    if (!values.size) throw new Error("BSE sovereign-gold-bond list was empty");
    securityCache = { expires: Date.now() + 24 * 60 * 60 * 1000, values };
    return values;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSgbQuote(ticker: string, security: BseSecurity): Promise<MarketQuote> {
  const cached = quoteCache.get(ticker);
  if (cached && cached.expires > Date.now()) return cached.quote;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const url = `${BSE_API}/getScripHeaderData/w?Debtflag=&scripcode=${encodeURIComponent(security.SCRIP_CD ?? "")}&seriesid=`;
    const response = await fetch(url, { headers: HEADERS, cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`BSE quote returned HTTP ${response.status}`);
    const data = await response.json() as BseHeader;
    const price = number(data.CurrRate?.LTP);
    const quote: MarketQuote = {
      ticker,
      price,
      previousClose: number(data.Header?.PrevClose),
      change: number(data.CurrRate?.Chg),
      changePercent: number(data.CurrRate?.PcChg),
      currency: "INR",
      marketTime: price == null ? null : new Date().toISOString(),
      sector: "Gold",
      marketCap: null,
      stale: price == null,
      instrumentType: "SGB",
      error: price == null ? "BSE returned no current SGB price" : undefined,
    };
    if (price != null) quoteCache.set(ticker, { expires: Date.now() + 5 * 60_000, quote });
    return quote;
  } catch (error) {
    const last = quoteCache.get(ticker)?.quote;
    const message = error instanceof Error ? error.message : "BSE SGB quote unavailable";
    return last ? { ...last, stale: true, error: message } : {
      ticker, price: null, previousClose: null, change: null, changePercent: null,
      currency: "INR", marketTime: null, sector: "Gold", marketCap: null,
      stale: true, instrumentType: "SGB", error: message,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function getSgbQuotes(rawTickers: string[]) {
  const tickers = [...new Set(rawTickers.map(normalizeSgbTicker).filter(Boolean))];
  if (!tickers.length) return [];
  try {
    const securities = await loadSgbSecurityMap();
    return Promise.all(tickers.map((ticker) => {
      const security = securities.get(ticker);
      return security ? fetchSgbQuote(ticker, security) : Promise.resolve<MarketQuote>({
        ticker, price: null, previousClose: null, change: null, changePercent: null,
        currency: "INR", marketTime: null, sector: "Gold", marketCap: null, stale: true,
        instrumentType: "SGB", error: "SGB symbol was not found in BSE's active debt list",
      });
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "BSE SGB data unavailable";
    return tickers.map((ticker): MarketQuote => ({
      ticker, price: null, previousClose: null, change: null, changePercent: null,
      currency: "INR", marketTime: null, sector: "Gold", marketCap: null, stale: true,
      instrumentType: "SGB", error: message,
    }));
  }
}
