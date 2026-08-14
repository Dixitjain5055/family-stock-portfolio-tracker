import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { getQuotes } from "@/lib/market/yahoo";

export async function GET(request: Request) {
  try {
    await requireUser();
    const tickers = new URL(request.url).searchParams.get("tickers")?.split(",") ?? [];
    if (!tickers.length) return NextResponse.json({ error: "At least one ticker is required" }, { status: 400 });
    const quotes = await getQuotes(tickers);
    return NextResponse.json({ quotes, delayed: true, fetchedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load quotes";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 503 });
  }
}

