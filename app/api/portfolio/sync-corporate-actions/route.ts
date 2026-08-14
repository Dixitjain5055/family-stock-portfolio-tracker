import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getChartEvents } from "@/lib/market/yahoo";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createSupabaseAdminClient();
  const { data: lots, error } = await admin.from("holdings").select("ticker,buy_date,created_at,exchange").eq("asset_type", "stock").not("exchange", "in", "(GOLD,SGB)").gt("remaining_quantity", 0);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const earliest = new Map<string, string>();
  for (const lot of lots ?? []) {
    const effectiveStart = lot.buy_date ?? lot.created_at.slice(0, 10);
    if (!earliest.has(lot.ticker) || effectiveStart < earliest.get(lot.ticker)!) earliest.set(lot.ticker, effectiveStart);
  }
  const events = await Promise.allSettled([...earliest].map(async ([ticker, date]) => ({ ticker, chart: await getChartEvents(ticker, new Date(date)) })));
  const processed: unknown[] = [], skipped: unknown[] = [], failed: unknown[] = [];
  for (const outcome of events) {
    if (outcome.status === "rejected") { failed.push({ error: String(outcome.reason) }); continue; }
    for (const split of outcome.value.chart.events?.splits ?? []) {
      const ratio = split.numerator / split.denominator;
      const externalId = `${outcome.value.ticker}:${split.date.toISOString()}:${split.splitRatio}`;
      const { data, error: rpcError } = await admin.rpc("apply_corporate_action", {
        p_ticker: outcome.value.ticker, p_action_type: "split", p_action_date: split.date.toISOString().slice(0, 10),
        p_ratio: ratio, p_external_event_id: externalId,
      });
      const detail = { ticker: outcome.value.ticker, date: split.date, ratio, result: data };
      if (rpcError) failed.push({ ...detail, error: rpcError.message });
      else if ((data as { status?: string })?.status === "skipped") skipped.push(detail);
      else processed.push(detail);
    }
  }
  return NextResponse.json({ processed, skipped, failed,
    note: "Only provider-confirmed splits are automatic. Unsupported bonus-equivalent events require manual review." });
}
