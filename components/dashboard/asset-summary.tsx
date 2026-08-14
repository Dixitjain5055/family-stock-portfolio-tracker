import { Coins, Gem, Landmark, PieChart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { PortfolioSummary } from "@/types/portfolio";

export function AssetSummary({ summary }: { summary: PortfolioSummary }) {
  const groups = [
    { type: "stock", label: "Stocks & ETFs", Icon: Landmark },
    { type: "mutual_fund", label: "Mutual funds", Icon: PieChart },
    { type: "sgb", label: "Sovereign gold bonds", Icon: Coins },
    { type: "gold", label: "Physical gold", Icon: Gem },
  ] as const;
  return <div className="grid gap-3 sm:grid-cols-2">{groups.map(({ type, label, Icon }) => { const holdings = summary.holdings.filter((row) => row.assetType === type); const value = holdings.reduce((sum, row) => sum + (row.currentValue ?? row.invested), 0); const invested = holdings.reduce((sum, row) => sum + row.invested, 0); return <Card key={type} className="flex items-center gap-4 p-5"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--accent-wash)] text-[var(--accent-strong)]"><Icon size={20} /></span><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{label}</p><p className="mt-1 text-xl font-bold">{formatCurrency(value, true)}</p><p className="text-[10px] text-[var(--muted)]">{holdings.length} holding{holdings.length === 1 ? "" : "s"} · cost {formatCurrency(invested, true)}</p></div></Card>; })}</div>;
}
