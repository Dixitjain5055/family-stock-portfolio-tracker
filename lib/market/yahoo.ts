import "server-only";
import YahooFinance from "yahoo-finance2";
import type { MarketQuote } from "@/types/portfolio";

const yahoo = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  validation: { logErrors: false },
  queue: { concurrency: 3, interval: 100 },
});
const QUOTE_TTL_MS = 60_000;
const cache = new Map<string, { quote: MarketQuote; expires: number }>();
const QUOTE_FIELDS = [
  "symbol",
  "regularMarketPrice",
  "regularMarketPreviousClose",
  "regularMarketChange",
  "regularMarketChangePercent",
  "regularMarketTime",
  "currency",
  "marketCap",
  "quoteType",
] as const;

function timeout<T>(promise: Promise<T>, ms = 8_000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Market-data request timed out")), ms)),
  ]);
}

export function normalizeTicker(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9.^=-]/g, "");
}

function unavailableQuote(ticker: string, error: string): MarketQuote {
  const stale = cache.get(ticker)?.quote;
  return stale ? { ...stale, stale: true, error } : {
    ticker, price: null, previousClose: null, change: null, changePercent: null,
    currency: null, marketTime: null, sector: null, marketCap: null, stale: true,
    error, instrumentType: undefined,
  };
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function marketTime(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "number" || typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function normalizeQuoteRow(row: unknown, requestedTicker: string): MarketQuote | null {
  if (!row || typeof row !== "object") return null;
  const data = row as Record<string, unknown>;
  const symbol = typeof data.symbol === "string" ? normalizeTicker(data.symbol) : requestedTicker;
  if (!symbol) return null;
  const price = finiteNumber(data.regularMarketPrice);
  return {
    ticker: symbol,
    price,
    previousClose: finiteNumber(data.regularMarketPreviousClose),
    change: finiteNumber(data.regularMarketChange),
    changePercent: finiteNumber(data.regularMarketChangePercent),
    currency: typeof data.currency === "string" ? data.currency : null,
    marketTime: marketTime(data.regularMarketTime),
    sector: null,
    marketCap: finiteNumber(data.marketCap),
    stale: price == null,
    instrumentType: typeof data.quoteType === "string" ? data.quoteType : undefined,
    error: price == null ? "Provider returned no current price for this symbol" : undefined,
  };
}

async function fetchSingleQuote(ticker: string): Promise<MarketQuote> {
  try {
    const row = await timeout(yahoo.quote(ticker, { fields: [...QUOTE_FIELDS] }));
    const quote = normalizeQuoteRow(row, ticker);
    if (quote) return quote;
  } catch {
    // Yahoo occasionally returns a valid quote with a provider field that is newer
    // than yahoo-finance2's schema. Retry only this symbol and validate the small
    // set of fields consumed by the app ourselves.
    try {
      const row: unknown = await timeout(
        yahoo.quote(ticker, { fields: [...QUOTE_FIELDS] }, { validateResult: false }),
      );
      const quote = normalizeQuoteRow(row, ticker);
      if (quote) return quote;
    } catch (error) {
      return unavailableQuote(ticker, error instanceof Error ? error.message : "Market data unavailable");
    }
  }
  return unavailableQuote(ticker, "Ticker was not returned by the market-data provider");
}

export async function getQuotes(rawTickers: string[]): Promise<MarketQuote[]> {
  const tickers = [...new Set(rawTickers.map(normalizeTicker).filter(Boolean))].slice(0, 100);
  const now = Date.now();
  const result = new Map<string, MarketQuote>();
  const missing: string[] = [];
  for (const ticker of tickers) {
    const cached = cache.get(ticker);
    if (cached && cached.expires > now) result.set(ticker, cached.quote);
    else missing.push(ticker);
  }

  if (missing.length) {
    try {
      const rows = await timeout(yahoo.quote(missing, { fields: [...QUOTE_FIELDS] }));
      for (const row of rows) {
        const quote = normalizeQuoteRow(row, "");
        if (!quote) continue;
        result.set(quote.ticker, quote);
        cache.set(quote.ticker, { quote, expires: now + QUOTE_TTL_MS });
      }
    } catch {
      const recovered = await Promise.all(missing.map(fetchSingleQuote));
      for (const quote of recovered) {
        result.set(quote.ticker, quote);
        if (quote.price != null) cache.set(quote.ticker, { quote, expires: now + QUOTE_TTL_MS });
      }
    }
    const unresolved = missing.filter((ticker) => !result.has(ticker));
    if (unresolved.length) {
      const recovered = await Promise.all(unresolved.map(fetchSingleQuote));
      for (const quote of recovered) {
        result.set(quote.ticker, quote);
        if (quote.price != null) cache.set(quote.ticker, { quote, expires: now + QUOTE_TTL_MS });
      }
    }
  }

  return tickers.map((ticker) =>
    result.get(ticker) ?? unavailableQuote(ticker, "Ticker was not returned by the market-data provider"));
}

export async function searchSecurities(query: string) {
  const value = query.trim().slice(0, 80);
  if (value.length < 1) return [];
  const response = await timeout(yahoo.search(value, { quotesCount: 10, newsCount: 0 }));
  return response.quotes
    .filter((row) => row.isYahooFinance && "symbol" in row)
    .slice(0, 10)
    .map((row) => ({
      ticker: String(row.symbol),
      name: "longname" in row ? row.longname ?? row.shortname ?? row.symbol : row.symbol,
      exchange: "exchange" in row ? row.exchange : "",
      type: "quoteType" in row ? row.quoteType : "SECURITY",
    }));
}

export async function getMutualFundNav(rawSchemes: string[]) {
  const quotes = await getQuotes(rawSchemes);
  return quotes.map((quote) => ({
    schemeCode: quote.ticker,
    nav: quote.price,
    previousNav: quote.previousClose,
    change: quote.change,
    changePercent: quote.changePercent,
    currency: quote.currency,
    navDate: quote.marketTime,
    active: quote.price != null && !quote.stale,
    stale: quote.stale,
    providerType: quote.instrumentType,
    error: quote.error,
  }));
}

export async function getChartEvents(ticker: string, period1: Date) {
  return timeout(yahoo.chart(normalizeTicker(ticker), {
    period1,
    period2: new Date(),
    interval: "1d",
    events: "div|split",
  }), 10_000);
}
