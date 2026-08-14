import { BadgeIndianRupee, BanknoteArrowUp, ChartNoAxesCombined, Coins } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import type { PortfolioSummary } from "@/types/portfolio";

export function ReturnsStrip({ summary }: { summary: PortfolioSummary }) {
  const items = [
    { label: "Invested", value: formatCurrency(summary.totalInvested, true), detail: "Adjusted cost", Icon: BadgeIndianRupee },
    { label: "Unrealized", value: formatCurrency(summary.unrealizedPl, true), detail: formatPercent(summary.unrealizedPlPercent), amount: summary.unrealizedPl, Icon: ChartNoAxesCombined },
    { label: "Today", value: formatCurrency(summary.dayChange, true), detail: `${formatPercent(summary.dayChangePercent)}${summary.dayChangeCoverage < 100 ? " · available quotes" : ""}`, amount: summary.dayChange, Icon: BanknoteArrowUp },
    { label: "Realized", value: formatCurrency(summary.realizedPl, true), detail: "After fees", amount: summary.realizedPl, Icon: Coins },
  ];
  return <Card className="mt-4 overflow-hidden"><div className="grid grid-cols-2 divide-x divide-y lg:grid-cols-4 lg:divide-y-0">{items.map(({ label, value, detail, amount, Icon }) => <div key={label} className="min-w-0 p-4 sm:p-5"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]"><Icon size={14} />{label}</div><p className={cn("mt-2 truncate text-lg font-bold tabular-nums", amount != null && (amount >= 0 ? "text-emerald-700" : "text-red-700"))}>{value}</p><p className="mt-0.5 text-[10px] text-[var(--muted)]">{detail}</p></div>)}</div></Card>;
}
