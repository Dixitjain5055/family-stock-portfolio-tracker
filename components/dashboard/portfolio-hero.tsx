import { Clock3, RefreshCw, ShieldAlert, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import type { PortfolioSummary } from "@/types/portfolio";

export function PortfolioHero({
  label,
  summary,
  combined,
  memberCount,
  pending,
  secondsToRefresh,
  demo,
  onRefresh,
}: {
  label: string;
  summary: PortfolioSummary;
  combined: boolean;
  memberCount: number;
  pending: boolean;
  secondsToRefresh: number;
  demo: boolean;
  onRefresh: () => void;
}) {
  const costValued = summary.holdings.filter((row) => row.valuationFallback).length;
  const stockLive = summary.holdings.filter((row) => row.assetType === "stock" && row.currentPrice != null && !row.quote?.stale).length;
  const stockStale = summary.holdings.filter((row) => row.assetType === "stock" && (row.currentPrice == null || row.quote?.stale)).length;
  const activeNav = summary.holdings.filter((row) => row.assetType === "mutual_fund" && row.currentPrice != null).length;
  const alternatives = summary.holdings.filter((row) => row.assetType === "sgb" || row.assetType === "gold").length;
  const latest = summary.lastRefresh ? new Date(summary.lastRefresh) : null;

  return <Card className="mt-6 overflow-hidden border-0 bg-gradient-to-br from-[#075f55] via-[#087367] to-[#0b8a79] text-white shadow-[0_20px_60px_-32px_rgba(3,70,62,.8)]">
    <div className="relative p-6 sm:p-8">
      <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-emerald-100">{combined ? <Users size={15} /> : <Sparkles size={15} />}{combined ? "Combined family wealth" : `${label} · personal wealth`}</p>
          <p className="mt-3 text-4xl font-bold tracking-[-.045em] sm:text-5xl">{formatCurrency(summary.totalValue, true)}</p>
          <p className="mt-2 text-sm text-emerald-50/80">Invested {formatCurrency(summary.totalInvested, true)} · {summary.holdings.length} active investments{combined ? ` · ${memberCount} members` : ""}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Unrealized</p><p className={cn("mt-1 text-lg font-bold", (summary.unrealizedPl ?? 0) < 0 && "text-rose-200")}>{formatCurrency(summary.unrealizedPl, true)}</p><p className="text-xs text-emerald-50/80">{formatPercent(summary.unrealizedPlPercent)}</p></div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Today</p><p className={cn("mt-1 text-lg font-bold", (summary.dayChange ?? 0) < 0 && "text-rose-200")}>{formatCurrency(summary.dayChange, true)}</p><p className="text-xs text-emerald-50/80">{formatPercent(summary.dayChangePercent)} · {Math.round(summary.dayChangeCoverage)}% covered</p></div>
          <div className="col-span-2 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur sm:col-span-1"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Realized</p><p className="mt-1 text-lg font-bold">{formatCurrency(summary.realizedPl, true)}</p><p className="text-xs text-emerald-50/80">After recorded fees</p></div>
        </div>
      </div>
      <div className="relative mt-7 flex flex-col gap-4 border-t border-white/15 pt-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
          <span className="rounded-full bg-white/14 px-3 py-1.5">{stockLive} live stocks</span>
          {stockStale > 0 && <span className="rounded-full bg-amber-300/20 px-3 py-1.5 text-amber-50">{stockStale} stale stocks</span>}
          {activeNav > 0 && <span className="rounded-full bg-violet-200/20 px-3 py-1.5">{activeNav} active NAV</span>}
          {alternatives > 0 && <span className="rounded-full bg-yellow-200/20 px-3 py-1.5">{alternatives} gold / SGB</span>}
          {costValued > 0 && <span className="flex items-center gap-1 rounded-full bg-rose-200/20 px-3 py-1.5"><ShieldAlert size={13} />{costValued} cost-valued</span>}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-emerald-50/75">
          <span className="flex items-center gap-1"><Clock3 size={13} />{latest ? latest.toLocaleString("en-IN") : "No market timestamp"}</span>
          <Button size="sm" className="border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={onRefresh} disabled={pending}><RefreshCw className={pending ? "animate-spin" : ""} size={14} />Refresh</Button>
          <span>{demo ? "Sample feed" : `Auto-refresh in ${secondsToRefresh}s`}</span>
        </div>
      </div>
      {costValued > 0 && <p className="relative mt-3 text-[10px] text-emerald-50/70">Unavailable instruments remain included at adjusted acquisition cost, so totals never disappear. Their unrealized return is shown as unavailable until a price is recovered.</p>}
    </div>
  </Card>;
}
