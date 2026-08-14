import { NextResponse } from "next/server";
import { getMutualFundMarketQuotes } from "@/lib/market/amfi";
import { requireUser } from "@/lib/supabase/auth";

export async function GET(request: Request) {
  try {
    await requireUser();
    const schemes = new URL(request.url).searchParams.get("schemes")?.split(",") ?? [];
    if (!schemes.length) return NextResponse.json({ error: "At least one mutual-fund scheme code is required." }, { status: 400 });
    const quotes = await getMutualFundMarketQuotes(schemes);
    const funds = quotes.map((quote) => ({
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
    return NextResponse.json({ funds, fetchedAt: new Date().toISOString(), delayed: true,
      note: "NAV is matched by AMFI scheme code or ISIN and reflects the latest end-of-day value published by AMFI." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "NAV data unavailable.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 503 });
  }
}
