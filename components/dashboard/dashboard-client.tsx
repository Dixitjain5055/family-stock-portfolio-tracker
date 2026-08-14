"use client";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { BellRing, ChartPie, Gem, History, LayoutDashboard, LoaderCircle, LogOut, Menu, Moon, RefreshCw, Sun, Users, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { fetchFilteredPortfolioSummary } from "@/app/actions/portfolio";
import { Analytics } from "@/components/dashboard/analytics";
import { AssetSummary } from "@/components/dashboard/asset-summary";
import { Highlights } from "@/components/dashboard/highlights";
import { MemberDrilldown } from "@/components/dashboard/member-drilldown";
import { MutualFundNav } from "@/components/dashboard/mutual-fund-nav";
import { PortfolioHero } from "@/components/dashboard/portfolio-hero";
import { HoldingsView } from "@/components/holdings/holdings-view";
import { LotDialog } from "@/components/holdings/lot-dialog";
import { ImportDialog } from "@/components/imports/import-dialog";
import { MemberDialog } from "@/components/members/member-dialog";
import { SellDialog } from "@/components/trades/sell-dialog";
import { TradeHistory } from "@/components/trades/trade-history";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { aggregateLots, summarizePortfolio } from "@/lib/portfolio/calculations";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { AggregatedHolding, ExitedTrade, FamilyMember, HoldingLot, MarketQuote, PortfolioSummary } from "@/types/portfolio";
import { ReturnsStrip } from "@/components/dashboard/returns-strip";
import { MutualFundHoldings } from "@/components/holdings/mutual-fund-holdings";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function DashboardClient({ members, allLots, initialSummary, trades, quotes, demo = false, showSignOut = false }: { members: FamilyMember[]; allLots: HoldingLot[]; initialSummary: PortfolioSummary; trades: ExitedTrade[]; quotes: MarketQuote[]; demo?: boolean; showSignOut?: boolean }) {
  const [memberId, setMemberId] = useState("all");
  const [summary, setSummary] = useState(initialSummary);
  const [pending, start] = useTransition();
  const [selling, setSelling] = useState<AggregatedHolding | null>(null);
  const [dark, setDark] = useState(false);
  const [menu, setMenu] = useState(false);
  const [secondsToRefresh, setSecondsToRefresh] = useState(60);
  const [signingOut, setSigningOut] = useState(false);
  const combined = memberId === "all";
  const activeMember = members.find((member) => member.id === memberId);
  const visibleTrades = useMemo(() => combined ? trades : trades.filter((trade) => trade.member_id === memberId), [trades, memberId, combined]);
  const load = useCallback((next = memberId, notify = true) => {
    start(async () => {
      if (demo) {
        const filtered = next === "all" ? allLots : allLots.filter((lot) => lot.member_id === next);
        const filteredTrades = next === "all" ? trades : trades.filter((trade) => trade.member_id === next);
        setSummary(summarizePortfolio(aggregateLots(filtered, quotes), filteredTrades.reduce((sum, trade) => sum + Number(trade.realized_pl), 0)));
        return;
      }
      const result = await fetchFilteredPortfolioSummary({ memberId: next === "all" ? null : next });
      if (result.ok && result.data) {
        setSummary(result.data);
        if (notify) toast.success("Live market data refreshed");
      } else if (notify) toast.error(result.ok ? "Portfolio returned no data." : result.error);
    });
  }, [memberId, demo, allLots, trades, quotes]);

  useEffect(() => {
    const stored = window.localStorage.getItem("kinfolio-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextDark = stored ? stored === "dark" : prefersDark;
    document.documentElement.dataset.theme = nextDark ? "dark" : "light";
    const frame = window.requestAnimationFrame(() => setDark(nextDark));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (demo) return;
    const countdown = window.setInterval(() => setSecondsToRefresh((seconds) => seconds <= 1 ? 60 : seconds - 1), 1000);
    const refresh = window.setInterval(() => load(memberId, false), 60_000);
    return () => { window.clearInterval(countdown); window.clearInterval(refresh); };
  }, [demo, load, memberId]);

  function changeView(value: string) { setMemberId(value); setSecondsToRefresh(60); load(value, false); }
  function manualRefresh() { setSecondsToRefresh(60); load(memberId, true); }
  function toggleTheme() {
    setDark((current) => {
      const next = !current;
      document.documentElement.dataset.theme = next ? "dark" : "light";
      window.localStorage.setItem("kinfolio-theme", next ? "dark" : "light");
      return next;
    });
  }
  async function signOut() { setSigningOut(true); await createSupabaseBrowserClient().auth.signOut(); location.assign("/auth"); }
  const alerts = summary.holdings.filter((holding) => Math.abs(holding.dayChangePercent ?? 0) > 5);
  const stockHoldings = summary.holdings.filter((holding) => holding.assetType === "stock");
  const mutualFunds = summary.holdings.filter((holding) => holding.assetType === "mutual_fund");
  const goldHoldings = summary.holdings.filter((holding) => holding.assetType === "sgb" || holding.assetType === "gold");

  return <main className="min-h-screen bg-[var(--canvas)] pb-24 text-[var(--ink)] transition-colors lg:pb-10">
    {demo && <div className="bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-950">Read-only sample data · Configure Supabase to turn on private live tracking and automatic refresh.</div>}
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r bg-[var(--surface)] px-4 py-5 lg:flex lg:flex-col"><a href="#top" className="flex items-center gap-3 px-2 text-lg font-extrabold"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent)] text-white">K</span>Kinfolio</a><p className="mt-8 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">Portfolio</p><nav className="mt-2 grid gap-1 text-sm font-semibold"><a className="flex items-center gap-3 rounded-xl bg-[var(--accent-wash)] px-3 py-3 text-[var(--accent-strong)]" href="#top"><LayoutDashboard size={17}/>Overview</a><a className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-[var(--surface-2)]" href="#equities"><WalletCards size={17}/>Stocks & ETFs</a><a className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-[var(--surface-2)]" href="#mutual-funds"><ChartPie size={17}/>Mutual funds</a><a className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-[var(--surface-2)]" href="#gold"><Gem size={17}/>Gold & SGB</a><a className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-[var(--surface-2)]" href="#analytics"><Users size={17}/>Allocation</a><a className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-[var(--surface-2)]" href="#history"><History size={17}/>Transactions</a></nav><div className="mt-auto border-t pt-4"><Button className="w-full justify-start" variant="ghost" onClick={toggleTheme}>{dark ? <Sun size={17}/> : <Moon size={17}/>} {dark ? "Light theme" : "Dark theme"}</Button></div></aside>
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color:var(--canvas)]/90 backdrop-blur-xl lg:ml-60"><div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3 sm:px-6"><a href="#top" className="mr-auto flex items-center gap-2 font-bold lg:hidden"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent)] text-white">K</span><span className="hidden sm:inline">Kinfolio</span></a><div className="mr-auto hidden text-left lg:block"><p className="text-xs font-bold">{combined ? "Family portfolio" : activeMember?.name}</p><p className="text-[10px] text-[var(--muted)]">{summary.lastRefresh ? `Updated ${new Date(summary.lastRefresh).toLocaleString("en-IN")}` : "Awaiting market refresh"}{summary.partialMarketData && " · partial valuation"}</p></div><Select aria-label="Global portfolio view" className="w-40 sm:w-48" value={memberId} onChange={(event) => changeView(event.target.value)}><option value="all">All Family</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</Select><Button variant="ghost" size="icon" aria-label="Refresh market data" onClick={manualRefresh} disabled={pending}>{pending ? <LoaderCircle className="animate-spin" size={18} /> : <RefreshCw size={18} />}</Button><Button className="lg:hidden" variant="ghost" size="icon" aria-label={dark ? "Use light theme" : "Use dark theme"} aria-pressed={dark} onClick={toggleTheme}>{dark ? <Sun size={18} /> : <Moon size={18} />}</Button>{showSignOut && <Button variant="ghost" size="icon" aria-label="Sign out" onClick={signOut} disabled={signingOut}>{signingOut ? <LoaderCircle className="animate-spin" size={18} /> : <LogOut size={18} />}</Button>}<Button className="lg:hidden" variant="ghost" size="icon" aria-label="Toggle actions" onClick={() => setMenu((value) => !value)}><Menu size={20} /></Button></div>{menu && <div className="flex gap-2 border-t p-3 lg:hidden"><MemberDialog disabled={demo} /><ImportDialog members={members} lots={allLots} disabled={demo} /></div>}</header>
    <div id="top" className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:ml-60"><section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--accent-strong)]">{combined ? "Combined dashboard" : "Individual dashboard"}</p><h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{combined ? "Portfolio overview" : `${activeMember?.name ?? "Member"}’s portfolio`}</h1><p className="mt-2 text-sm text-[var(--muted)]">{combined ? "One clean view of every family asset, with ownership kept intact." : "Holdings, returns, transactions, and allocation for this member only."}</p></div><div className="flex flex-wrap gap-2"><div className="hidden lg:block"><MemberDialog disabled={demo} /></div><div className="hidden lg:block"><ImportDialog members={members} lots={allLots} disabled={demo} /></div><LotDialog members={members} disabled={demo} /></div></section>
      <PortfolioHero label={combined ? "Family" : activeMember?.name ?? "Member"} summary={summary} combined={combined} memberCount={members.length} pending={pending} secondsToRefresh={secondsToRefresh} demo={demo} onRefresh={manualRefresh} />
      {alerts.length > 0 && <section aria-label="Volatility alerts" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 font-bold text-amber-950"><BellRing size={18} /> Volatility alert</div><div className="mt-3 flex flex-wrap gap-2">{alerts.map((holding) => <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-amber-950" key={`${holding.assetType}:${holding.ticker}`}>{holding.ticker} · {holding.owners.length === 1 ? holding.owners[0].memberName : `${holding.owners.length} owners`} · {formatPercent(holding.dayChangePercent)} · {formatCurrency(holding.currentPrice)} · {holding.quote?.marketTime ? new Date(holding.quote.marketTime).toLocaleTimeString("en-IN") : "time unavailable"}</span>)}</div></section>}
      <ReturnsStrip summary={summary} />
      {combined ? <section className="mt-6 grid gap-4 xl:grid-cols-[.75fr_1.25fr]"><MemberDrilldown members={members} summary={summary} onSelect={changeView} /><AssetSummary summary={summary} /></section> : <section className="mt-6"><AssetSummary summary={summary} /></section>}
      <nav aria-label="Dashboard sections" className="sticky top-[65px] z-20 mt-6 flex gap-1 overflow-x-auto rounded-xl border bg-[color:var(--surface)]/90 p-1.5 text-xs font-semibold shadow-sm backdrop-blur"><a className="whitespace-nowrap rounded-lg px-3 py-2 hover:bg-[var(--surface-2)]" href="#equities">Equities · {stockHoldings.length}</a><a className="whitespace-nowrap rounded-lg px-3 py-2 hover:bg-violet-50 hover:text-violet-700" href="#mutual-funds">Mutual funds · {mutualFunds.length}</a><a className="whitespace-nowrap rounded-lg px-3 py-2 hover:bg-amber-50" href="#gold">Gold · {goldHoldings.length}</a><a className="whitespace-nowrap rounded-lg px-3 py-2 hover:bg-[var(--surface-2)]" href="#analytics">Allocation</a><a className="whitespace-nowrap rounded-lg px-3 py-2 hover:bg-[var(--surface-2)]" href="#history">Transactions</a></nav>
      <section id="equities" className="scroll-mt-32 mt-9"><div className="mb-4 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent-strong)]">Equity portfolio</p><h2 className="mt-1 text-xl font-bold">{combined ? "Consolidated stock holdings" : "Personal stock holdings"}</h2><p className="mt-1 text-xs text-[var(--muted)]">{combined ? "Shared stocks appear once; expand for each member and acquisition lot." : "Every acquisition lot belongs only to the selected member."}</p></div><span className="text-xs font-semibold text-[var(--muted)]">{stockHoldings.length} stocks</span></div><HoldingsView holdings={stockHoldings} onSell={setSelling} /></section>
      <section id="mutual-funds" className="scroll-mt-32 mt-10"><div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-700">Fund portfolio</p><h2 className="mt-1 text-xl font-bold">Mutual fund holdings</h2><p className="mt-1 text-xs text-[var(--muted)]">Units remain lot-traceable while shared schemes consolidate across family members.</p></div><span className="text-xs font-semibold text-[var(--muted)]">{mutualFunds.length} {mutualFunds.length === 1 ? "scheme" : "schemes"}</span></div><MutualFundNav holdings={mutualFunds} /><div className="mt-4"><MutualFundHoldings funds={mutualFunds} onSell={setSelling} /></div></section>
      <section id="gold" className="scroll-mt-32 mt-10"><div className="mb-4 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-amber-700">Gold portfolio</p><h2 className="mt-1 text-xl font-bold">Physical gold & sovereign gold bonds</h2><p className="mt-1 text-xs text-[var(--muted)]">Physical gold is tracked in grams; listed SGB prices use the exchange quote source when available.</p></div><span className="text-xs font-semibold text-[var(--muted)]">{goldHoldings.length} holdings</span></div><HoldingsView holdings={goldHoldings} onSell={setSelling} /></section>
      <section className="mt-9"><h2 className="mb-4 text-xl font-bold">{combined ? "Family highlights" : "Personal highlights"}</h2><Highlights holdings={summary.holdings} /></section>
      <section id="analytics" className="mt-9"><h2 className="mb-4 text-xl font-bold">{combined ? "Family allocation" : "Personal allocation"}</h2><Analytics holdings={summary.holdings} combined={combined} /></section>
      <section id="history" className="mt-9"><TradeHistory trades={visibleTrades} /></section>
    </div><SellDialog holding={selling} open={Boolean(selling)} onOpenChange={(open) => !open && setSelling(null)} />
    <nav aria-label="Mobile navigation" className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 rounded-2xl border bg-[color:var(--surface)]/95 p-2 shadow-xl backdrop-blur lg:hidden"><a className="flex min-h-12 flex-col items-center justify-center text-[10px] font-semibold" href="#top"><LayoutDashboard size={19} />Overview</a><a className="flex min-h-12 flex-col items-center justify-center text-[10px] font-semibold" href="#equities"><WalletCards size={19} />Stocks</a><a className="flex min-h-12 flex-col items-center justify-center text-[10px] font-semibold" href="#mutual-funds"><ChartPie size={19} />Funds</a><a className="flex min-h-12 flex-col items-center justify-center text-[10px] font-semibold" href="#gold"><Gem size={19} />Gold</a></nav>
  </main>;
}
