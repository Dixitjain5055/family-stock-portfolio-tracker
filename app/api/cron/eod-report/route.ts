import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { aggregateLots, summarizePortfolio } from "@/lib/portfolio/calculations";
import { getPortfolioMarketQuotes } from "@/lib/market/amfi";
import type { HoldingLot } from "@/types/portfolio";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const admin = createSupabaseAdminClient();
    const { data: rawLots, error } = await admin.from("holdings").select("*,family_members!inner(id,name,user_id)").gt("remaining_quantity", 0);
    if (error) throw error;
    const typedLots = (rawLots ?? []) as unknown as HoldingLot[];
    const quotes = await getPortfolioMarketQuotes(typedLots);
    const byUser = new Map<string, HoldingLot[]>();
    for (const raw of rawLots ?? []) {
      const member = raw.family_members as unknown as { user_id: string };
      byUser.set(member.user_id, [...(byUser.get(member.user_id) ?? []), raw as unknown as HoldingLot]);
    }
    const timestamp = new Date().toISOString();
    const reports = [];
    for (const [userId, lots] of byUser) {
      const holdings = aggregateLots(lots, quotes);
      const summary = summarizePortfolio(holdings);
      const sorted = [...holdings].filter((row) => row.dayChangePercent != null).sort((a, b) => (b.dayChangePercent ?? 0) - (a.dayChangePercent ?? 0));
      const members = new Map<string, { member: string; value: number | null; invested: number }>();
      for (const row of holdings) for (const owner of row.owners) {
        const entry = members.get(owner.memberId) ?? { member: owner.memberName, value: 0, invested: 0 };
        entry.invested += owner.invested;
        entry.value = (entry.value ?? 0) + (row.currentPrice == null ? owner.invested : owner.quantity * row.currentPrice);
        members.set(owner.memberId, entry);
      }
      reports.push({ userId, portfolioValue: summary.totalValue, dayChange: summary.dayChange, dayChangePercent: summary.dayChangePercent,
        topGainer: sorted[0] ?? null, topLoser: sorted.at(-1) ?? null,
        volatilityAlerts: holdings.filter((row) => Math.abs(row.dayChangePercent ?? 0) > 5).map((row) => ({ ticker: row.ticker,
          owners: row.owners.length, movePercent: row.dayChangePercent, currentPrice: row.currentPrice,
          direction: (row.dayChangePercent ?? 0) > 0 ? "up" : "down", timestamp: row.quote?.marketTime })),
        perMember: [...members.values()], partialMarketData: summary.partialMarketData, reportTimestamp: timestamp });
    }
    return NextResponse.json({ reports, reportTimestamp: timestamp, disclaimer: "Yahoo Finance data may be delayed." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Report failed" }, { status: 503 });
  }
}
