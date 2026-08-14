"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronUp, MoreHorizontal, PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { sortAggregatedHoldings, type HoldingSortKey } from "@/lib/portfolio/sorting";
import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import type { AggregatedHolding } from "@/types/portfolio";

type FundSortKey = Extract<HoldingSortKey, "name" | "quantity" | "averagePrice" | "currentPrice" | "invested" | "currentValue" | "unrealizedPl">;

function ReturnValue({ value, percent, fallback }: { value: number | null; percent: number | null; fallback?: boolean }) {
  if (fallback) return <div><p className="font-semibold tabular-nums text-[var(--muted)]">Unavailable</p><p className="text-[10px] text-[var(--muted)]">Cost value used</p></div>;
  return <div className={cn("font-semibold tabular-nums", value == null ? "text-[var(--muted)]" : value >= 0 ? "text-emerald-700" : "text-red-700")}><span>{formatCurrency(value)}</span><span className={cn("ml-1 rounded-full px-1.5 py-0.5 text-xs", value != null && value >= 0 ? "bg-emerald-50" : "bg-red-50")}>{formatPercent(percent)}</span></div>;
}

function Owners({ fund }: { fund: AggregatedHolding }) {
  return <div className="grid gap-3 border-t bg-violet-50/40 p-4 sm:grid-cols-2 xl:grid-cols-3">{fund.owners.map((owner) => <div key={owner.memberId} className="rounded-xl border bg-[var(--surface)] p-3"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">{owner.memberName[0]?.toUpperCase()}</span><div className="min-w-0"><p className="truncate font-bold">{owner.memberName}</p><p className="truncate text-xs text-[var(--muted)]">{owner.brokers.join(", ") || "Platform not set"}</p></div></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><p className="text-[var(--muted)]">Units</p><p className="mt-0.5 font-semibold">{formatNumber(owner.quantity, 4)}</p></div><div><p className="text-[var(--muted)]">Average NAV</p><p className="mt-0.5 font-semibold">{formatCurrency(owner.averagePrice)}</p></div></div><p className="mt-2 text-[10px] text-[var(--muted)]">{owner.lots.length} acquisition lot{owner.lots.length === 1 ? "" : "s"}</p></div>)}</div>;
}

export function MutualFundHoldings({ funds, onSell }: { funds: AggregatedHolding[]; onSell: (fund: AggregatedHolding) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<FundSortKey>("invested");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const sortedFunds = useMemo(
    () => sortAggregatedHoldings(funds, sortKey, sortDirection),
    [funds, sortDirection, sortKey],
  );
  function toggleSort(key: FundSortKey) {
    if (sortKey === key) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDirection(key === "name" ? "asc" : "desc");
    }
  }
  function icon(key: FundSortKey) {
    if (sortKey !== key) return <ArrowUpDown size={12} aria-hidden="true" />;
    return sortDirection === "asc" ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />;
  }
  if (!funds.length) return <Card className="grid min-h-48 place-items-center border-dashed p-8 text-center"><div><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-violet-50 text-violet-700"><PieChart size={20} /></div><h3 className="mt-4 font-bold">No mutual-fund holdings</h3><p className="mt-1 max-w-sm text-sm text-[var(--muted)]">Add a fund purchase with units and purchase NAV, or import a statement.</p></div></Card>;
  const sortOptions: Array<[FundSortKey, string]> = [["invested","Invested"],["name","Scheme"],["quantity","Units"],["averagePrice","Purchase NAV"],["currentPrice","Current NAV"],["currentValue","Value"],["unrealizedPl","Return"]];
  return <div><div className="mb-3 flex gap-1 overflow-x-auto" aria-label="Sort mutual funds">{sortOptions.map(([key,label])=><button type="button" key={key} onClick={()=>toggleSort(key)} aria-pressed={sortKey===key} className={cn("inline-flex min-h-10 items-center gap-1 whitespace-nowrap rounded-lg border px-3 text-xs font-semibold",sortKey===key&&"bg-[var(--surface-2)]")}>{label}{icon(key)}</button>)}</div><div className="grid gap-3">{sortedFunds.map((fund) => { const isOpen = expanded === fund.ticker; const navStatus = fund.currentPrice == null ? "NAV unavailable · cost-valued" : fund.quote?.stale ? "Last available NAV" : "Active NAV"; return <Card key={fund.ticker} className="overflow-hidden"><div className="grid items-center gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(220px,1.5fr)_repeat(5,minmax(90px,.7fr))_44px]"><div className="min-w-0"><div className="flex items-center gap-2"><span className="rounded-md bg-violet-100 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-violet-700">Mutual fund</span><span className={cn("rounded-full px-2 py-1 text-[9px] font-bold", fund.currentPrice == null ? "bg-slate-100 text-slate-600" : fund.quote?.stale ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700")}>{navStatus}</span></div><p className="mt-2 truncate font-bold">{fund.companyName}</p><p className="mt-0.5 text-xs text-[var(--muted)]">{fund.ticker} · {fund.owners.length} owner{fund.owners.length === 1 ? "" : "s"}</p></div><div><p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Units</p><p className="mt-1 font-semibold tabular-nums">{formatNumber(fund.quantity, 4)}</p></div><div><p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Purchase NAV</p><p className="mt-1 font-semibold tabular-nums">{formatCurrency(fund.averagePrice)}</p></div><div><p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Current NAV</p><p className="mt-1 font-semibold tabular-nums">{formatCurrency(fund.currentPrice)}</p></div><div><p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Invested</p><p className="mt-1 font-semibold tabular-nums">{formatCurrency(fund.invested)}</p></div><div><p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Current value</p><p className="mt-1 font-semibold tabular-nums">{formatCurrency(fund.currentValue)}</p>{fund.valuationFallback && <p className="text-[9px] text-[var(--muted)]">at cost</p>}</div><div><p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Return</p><ReturnValue value={fund.unrealizedPl} percent={fund.unrealizedPlPercent} fallback={fund.valuationFallback} /></div><div className="flex lg:flex-col"><Button size="icon" variant="ghost" aria-label={`${isOpen ? "Hide" : "Show"} ${fund.companyName} ownership`} aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : fund.ticker)}>{isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</Button><Button size="icon" variant="ghost" aria-label={`Choose ${fund.ticker} lot to redeem`} onClick={() => onSell(fund)}><MoreHorizontal size={18} /></Button></div></div>{isOpen && <><Owners fund={fund} /><div className="flex flex-col gap-2 border-t bg-violet-50/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-[var(--muted)]">Redemptions always target a specific member and acquisition lot.</p><Button size="sm" variant="outline" onClick={() => onSell(fund)}>Choose lot to redeem</Button></div></>}</Card>; })}</div></div>;
}
