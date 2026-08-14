import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { FamilyMember, PortfolioSummary } from "@/types/portfolio";

export function MemberDrilldown({ members, summary, onSelect }: { members: FamilyMember[]; summary: PortfolioSummary; onSelect: (memberId: string) => void }) {
  const totals = new Map<string, number>();
  for (const holding of summary.holdings) for (const owner of holding.owners) totals.set(owner.memberId, (totals.get(owner.memberId) ?? 0) + (holding.currentPrice == null ? owner.invested : owner.quantity * holding.currentPrice));
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  return <Card><CardHeader><h2 className="font-bold">Family members</h2><p className="mt-1 text-xs text-[var(--muted)]">Open an individual dashboard with one click</p></CardHeader><CardContent><div className="space-y-2">{members.map((member) => { const value = totals.get(member.id) ?? 0; return <button key={member.id} onClick={() => onSelect(member.id)} className="group flex min-h-16 w-full items-center gap-3 rounded-xl border bg-[var(--surface)] p-3 text-left transition hover:border-[var(--accent)] hover:bg-[var(--surface-2)]"><span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent-wash)] font-bold text-[var(--accent-strong)]">{member.name[0]?.toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{member.name}</span><span className="text-[10px] text-[var(--muted)]">{total ? ((value / total) * 100).toFixed(1) : 0}% of family portfolio</span></span><span className="text-right"><span className="block text-sm font-bold">{formatCurrency(value, true)}</span><ArrowRight className="ml-auto mt-1 text-[var(--muted)] transition group-hover:translate-x-1" size={14} /></span></button>; })}</div></CardContent></Card>;
}

