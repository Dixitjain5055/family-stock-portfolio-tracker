import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { searchSecurities } from "@/lib/market/yahoo";

export async function GET(request: Request) {
  try {
    await requireUser();
    const query = new URL(request.url).searchParams.get("q") ?? "";
    if (!query.trim()) return NextResponse.json({ results: [] });
    return NextResponse.json({ results: await searchSecurities(query) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 503 });
  }
}

