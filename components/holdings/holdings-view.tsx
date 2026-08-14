"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronUp, MoreHorizontal, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { sortAggregatedHoldings, type HoldingSortKey as SortKey, type SortDirection } from "@/lib/portfolio/sorting";
import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import type { AggregatedHolding } from "@/types/portfolio";

function Pnl({ value, percent, fallback = false }: { value: number | null; percent: number | null; fallback?: boolean }) {
  if (fallback) return <div className="text-xs font-semibold text-[var(--muted)]">Unavailable<br/><span className="text-[9px] font-normal">cost value used</span></div>;
  return <div className={cn("font-semibold", value == null ? "text-[var(--muted)]" : value >= 0 ? "text-emerald-700" : "text-red-700")}><span>{formatCurrency(value)}</span><span className="ml-1 text-xs">{formatPercent(percent)}</span></div>;
}

function Breakdown({ row }: { row: AggregatedHolding }) {
  const unit = row.assetType === "mutual_fund" ? "units" : row.assetType === "gold" ? "grams" : row.assetType === "sgb" ? "bonds" : "shares";
  return <div className="grid gap-2 bg-[var(--surface-2)] p-4 sm:grid-cols-2">{row.owners.map((owner) => <div key={owner.memberId} className="rounded-xl border bg-[var(--surface)] p-3"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent-wash)] text-xs font-bold text-[var(--accent-strong)]">{owner.memberName.slice(0, 1).toUpperCase()}</span><div><p className="font-bold">{owner.memberName}</p><p className="text-xs text-[var(--muted)]">{owner.brokers.join(", ") || "Broker not set"}</p></div></div><div className="mt-3 flex justify-between text-sm"><span>{formatNumber(owner.quantity, 4)} {unit}</span><span>Avg. {row.assetType === "mutual_fund" ? "NAV " : ""}{formatCurrency(owner.averagePrice)}</span></div><p className="mt-2 text-xs text-[var(--muted)]">{owner.lots.length} acquisition lot{owner.lots.length === 1 ? "" : "s"}</p></div>)}</div>;
}

export function HoldingsView({ holdings, onSell }: { holdings: AggregatedHolding[]; onSell: (holding: AggregatedHolding) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("invested");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const sortedHoldings = useMemo(
    () => sortAggregatedHoldings(holdings, sortKey, sortDirection),
    [holdings, sortDirection, sortKey],
  );
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDirection(key === "name" || key === "broker" ? "asc" : "desc");
    }
  }
  function icon(key: SortKey) {
    if (sortKey !== key) return <ArrowUpDown size={12} aria-hidden="true" />;
    return sortDirection === "asc" ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />;
  }
  if (!holdings.length) return <Card className="grid min-h-56 place-items-center p-8 text-center"><div><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--surface-2)]"><ShoppingCart className="text-[var(--muted)]" /></div><h3 className="mt-4 font-bold">No active investments yet</h3><p className="mt-1 max-w-sm text-sm text-[var(--muted)]">Add a stock or mutual-fund purchase manually, or import a statement.</p></div></Card>;
  const key = (row: AggregatedHolding) => `${row.assetType}:${row.ticker}`;
  const headers: Array<[SortKey, string]> = [
    ["name", "Security"],
    ["owners", "Owners"],
    ["broker", "Broker"],
    ["quantity", "Quantity"],
    ["averagePrice", "Avg. cost"],
    ["currentPrice", "Price"],
    ["invested", "Invested"],
    ["currentValue", "Value"],
    ["unrealizedPl", "Overall P/L"],
    ["dayChange", "Today"],
  ];
  return <><div className="mb-3 flex gap-1 overflow-x-auto lg:hidden" aria-label="Sort holdings">{[["invested","Invested"],["name","Name"],["quantity","Quantity"],["currentValue","Value"],["unrealizedPl","Return"]] .map(([value,label])=><button type="button" key={value} onClick={()=>toggleSort(value as SortKey)} className={cn("inline-flex min-h-10 items-center gap-1 whitespace-nowrap rounded-lg border px-3 text-xs font-semibold",sortKey===value&&"bg-[var(--surface-2)]")}>{label}{icon(value as SortKey)}</button>)}</div><div className="hidden overflow-hidden rounded-2xl border bg-[var(--surface)] lg:block"><table className="w-full text-left text-sm"><thead className="bg-[var(--surface-2)] text-xs uppercase tracking-wider text-[var(--muted)]"><tr>{headers.map(([value,label])=><th key={value} className="whitespace-nowrap px-4 py-1 font-semibold" aria-sort={sortKey===value?(sortDirection==="asc"?"ascending":"descending"):"none"}><button type="button" className="inline-flex min-h-10 items-center gap-1" onClick={()=>toggleSort(value)}>{label}{icon(value)}</button></th>)}<th className="px-4 py-3 font-semibold">Actions</th></tr></thead><tbody>{sortedHoldings.map((row) => <Rows key={key(row)} row={row} expanded={expanded === key(row)} toggle={() => setExpanded(expanded === key(row) ? null : key(row))} onSell={() => onSell(row)} />)}</tbody></table></div><div className="grid gap-3 lg:hidden">{sortedHoldings.map((row) => <MobileCard key={key(row)} row={row} expanded={expanded === key(row)} toggle={() => setExpanded(expanded === key(row) ? null : key(row))} onSell={() => onSell(row)} />)}</div></>;
}

function AssetBadge({ row }: { row: AggregatedHolding }) {
  const labels = { mutual_fund: "FUND", sgb: "SGB", gold: "GOLD", stock: "" };
  return labels[row.assetType] ? <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">{labels[row.assetType]}</span> : null;
}

function Rows({ row, expanded, toggle, onSell }: { row: AggregatedHolding; expanded: boolean; toggle: () => void; onSell: () => void }) {
  return <><tr className="border-t hover:bg-[var(--surface-2)]/50"><td className="px-4 py-4"><button onClick={toggle} className="flex items-center gap-2 text-left"><span className="font-bold">{row.ticker}</span><AssetBadge row={row} />{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button><p className="max-w-40 truncate text-xs text-[var(--muted)]">{row.companyName}</p></td><td className="px-4"><div className="flex -space-x-2">{row.owners.slice(0, 3).map((owner) => <span title={owner.memberName} key={owner.memberId} className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[var(--accent-wash)] text-[10px] font-bold">{owner.memberName[0]}</span>)}</div><span className="text-xs text-[var(--muted)]">{row.owners.length} owner{row.owners.length === 1 ? "" : "s"}</span></td><td className="px-4 text-xs">{[...new Set(row.owners.flatMap((owner) => owner.brokers))].join(", ") || "—"}</td><td className="px-4 font-semibold">{formatNumber(row.quantity, row.assetType === "mutual_fund" ? 4 : 2)}</td><td className="px-4">{formatCurrency(row.averagePrice)}</td><td className="px-4">{formatCurrency(row.currentPrice)}{row.quote?.stale && <span className="ml-1 text-[10px] text-amber-700">stale</span>}</td><td className="px-4">{formatCurrency(row.invested)}</td><td className="px-4 font-semibold">{formatCurrency(row.currentValue)}{row.valuationFallback && <span className="ml-1 text-[9px] text-[var(--muted)]">at cost</span>}</td><td className="px-4"><Pnl value={row.unrealizedPl} percent={row.unrealizedPlPercent} fallback={row.valuationFallback} /></td><td className="px-4"><Pnl value={row.dayChange} percent={row.dayChangePercent} /></td><td className="px-4"><Button variant="ghost" size="sm" aria-label={`Choose ${row.ticker} lot to sell`} onClick={onSell}><MoreHorizontal size={18} /></Button></td></tr>{expanded && <tr><td colSpan={11}><Breakdown row={row} /><div className="flex items-center justify-between bg-[var(--surface-2)] px-4 pb-4"><p className="text-xs text-[var(--muted)]">Combined positions cannot be edited ambiguously. Select a member lot in the sale workflow.</p><Button size="sm" variant="outline" onClick={onSell}>Choose lot to sell</Button></div></td></tr>}</>;
}

function MobileCard({ row, expanded, toggle, onSell }: { row: AggregatedHolding; expanded: boolean; toggle: () => void; onSell: () => void }) {
  const unit = row.assetType === "mutual_fund" ? "units" : row.assetType === "gold" ? "grams" : row.assetType === "sgb" ? "bonds" : "shares";
  return <Card className="overflow-hidden"><button className="w-full p-4 text-left" onClick={toggle}><div className="flex items-start justify-between"><div><div className="flex items-center gap-2"><span className="text-lg font-bold">{row.ticker}</span><AssetBadge row={row} /><span className="rounded-full bg-[var(--surface-2)] px-2 py-1 text-[10px] font-semibold">{row.owners.length} owner{row.owners.length === 1 ? "" : "s"}</span></div><p className="mt-1 text-xs text-[var(--muted)]">{formatNumber(row.quantity, 4)} {unit} · Avg. {row.assetType === "mutual_fund" ? "NAV " : ""}{formatCurrency(row.averagePrice)}</p></div>{expanded ? <ChevronUp /> : <ChevronDown />}</div><div className="mt-5 grid grid-cols-2 gap-3"><div><p className="text-xs text-[var(--muted)]">Current value</p><p className="mt-1 font-bold">{formatCurrency(row.currentValue)}</p>{row.valuationFallback && <p className="text-[9px] text-[var(--muted)]">acquisition cost used</p>}</div><div><p className="text-xs text-[var(--muted)]">Overall return</p><Pnl value={row.unrealizedPl} percent={row.unrealizedPlPercent} fallback={row.valuationFallback} /></div></div></button>{expanded && <><Breakdown row={row} /><div className="p-4 pt-0"><Button className="w-full" variant="outline" onClick={onSell}>Select member & lot to sell</Button></div></>}</Card>;
}
