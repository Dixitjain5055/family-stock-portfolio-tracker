import "server-only";
import type { MarketQuote } from "@/types/portfolio";
import { getQuotes } from "./yahoo";

const GOLD_API_URL = "https://api.gold-api.com/price/XAU";
const GRAMS_PER_TROY_OUNCE = 31.1034768;
const PURITY: Record<string, number> = {
  "GOLD-24K": 1,
  "GOLD-22K": 0.916,
  "GOLD-18K": 0.75,
};

let goldCache: { expires: number; usdPerOunce: number; updatedAt: string } | null = null;

export function normalizeGoldTicker(value: string) {
  const ticker = value.trim().toUpperCase().replace(/\s+/g, "");
  if (/^(?:GOLD-?)?(?:22K|916)$/.test(ticker)) return "GOLD-22K";
  if (/^(?:GOLD-?)?(?:18K|750)$/.test(ticker)) return "GOLD-18K";
  return "GOLD-24K";
}

async function loadGoldUsd() {
  if (goldCache && goldCache.expires > Date.now()) return goldCache;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(GOLD_API_URL, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Gold price feed returned HTTP ${response.status}`);
    const data = await response.json() as { price?: number; updatedAt?: string };
    if (!(Number(data.price) > 0)) throw new Error("Gold price feed returned no price");
    goldCache = {
      expires: Date.now() + 10 * 60_000,
      usdPerOunce: Number(data.price),
      updatedAt: data.updatedAt && !Number.isNaN(new Date(data.updatedAt).getTime())
        ? new Date(data.updatedAt).toISOString()
        : new Date().toISOString(),
    };
    return goldCache;
  } finally {
    clearTimeout(timer);
  }
}

export async function getPhysicalGoldQuotes(rawTickers: string[]): Promise<MarketQuote[]> {
  const tickers = [...new Set(rawTickers.map(normalizeGoldTicker))];
  if (!tickers.length) return [];
  try {
    const [gold, forexRows] = await Promise.all([loadGoldUsd(), getQuotes(["INR=X"])]);
    const forex = forexRows[0];
    if (forex?.price == null) throw new Error("USD/INR conversion rate unavailable");
    const inrPerUsd = forex.price;
    return tickers.map((ticker) => ({
      ticker,
      price: gold.usdPerOunce * inrPerUsd / GRAMS_PER_TROY_OUNCE * (PURITY[ticker] ?? 1),
      previousClose: null,
      change: null,
      changePercent: null,
      currency: "INR",
      marketTime: gold.updatedAt,
      sector: "Gold",
      marketCap: null,
      stale: forex.stale || Date.now() - new Date(gold.updatedAt).getTime() > 60 * 60_000,
      instrumentType: "PHYSICAL_GOLD",
      error: forex.error,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Physical-gold price unavailable";
    return tickers.map((ticker) => ({
      ticker, price: null, previousClose: null, change: null, changePercent: null,
      currency: "INR", marketTime: null, sector: "Gold", marketCap: null, stale: true,
      instrumentType: "PHYSICAL_GOLD", error: message,
    }));
  }
}
