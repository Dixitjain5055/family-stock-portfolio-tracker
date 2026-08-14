"use client";
import { useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createAcquisitionLot } from "@/app/actions/portfolio";
import { BrokerOptions } from "@/components/holdings/broker-options";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import type { AssetType, FamilyMember } from "@/types/portfolio";

type SearchResult = { ticker: string; name: string; exchange: string; type: string };

export function LotDialog({ members, disabled = false, defaultTicker = "" }: { members: FamilyMember[]; disabled?: boolean; defaultTicker?: string }) {
  const [open, setOpen] = useState(false);
  const [ticker, setTicker] = useState(defaultTicker);
  const [assetType, setAssetType] = useState<AssetType>("stock");
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [broker, setBroker] = useState(members[0]?.default_broker ?? "");
  const [pending, start] = useTransition();
  const searchable = assetType === "stock" || assetType === "mutual_fund";
  const search = useQuery({
    queryKey: ["ticker-search", ticker],
    queryFn: async () => {
      const response = await fetch(`/api/market/search?q=${encodeURIComponent(ticker)}`);
      if (!response.ok) throw new Error("Search unavailable");
      return (await response.json()).results as SearchResult[];
    },
    enabled: open && searchable && ticker.length >= 2,
  });

  function choose(row: SearchResult) {
    setTicker(row.ticker);
    setAssetType(row.type === "MUTUALFUND" ? "mutual_fund" : "stock");
  }
  function chooseMember(id: string) {
    setMemberId(id);
    setBroker(members.find((member) => member.id === id)?.default_broker ?? "");
  }
  function chooseAssetType(next: AssetType) {
    setAssetType(next);
    if (next === "gold") setTicker("GOLD-24K");
    else if (ticker.startsWith("GOLD-")) setTicker("");
  }
  function submit(form: FormData) {
    start(async () => {
      const result = await createAcquisitionLot({
        memberId: form.get("memberId"), ticker: form.get("ticker"), assetType: form.get("assetType"),
        exchange: form.get("exchange"), companyName: form.get("companyName"), quantity: form.get("quantity"),
        buyPrice: form.get("buyPrice"), buyDate: null, broker: form.get("broker"), source: "manual",
      });
      if (result.ok) { toast.success(result.message); setOpen(false); } else toast.error(result.error);
    });
  }

  const fund = assetType === "mutual_fund";
  const gold = assetType === "gold";
  const sgb = assetType === "sgb";
  const exchange = fund ? "MUTUAL_FUND" : gold ? "GOLD" : sgb ? "SGB" : "NSE";
  const quantityLabel = fund ? "Units" : gold ? "Weight in grams" : sgb ? "Bond units" : "Quantity";
  const priceLabel = fund ? "Purchase NAV" : gold ? "Purchase price per gram" : sgb ? "Purchase price per bond" : "Buy price";

  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="primary" disabled={disabled || !members.length}><Plus size={18} /> Add investment</Button></DialogTrigger><DialogContent><DialogTitle>Add investment lot</DialogTitle><DialogDescription>Track stocks, funds, sovereign gold bonds, and physical gold without losing lot-level ownership.</DialogDescription><form action={submit} className="mt-6 grid gap-4 sm:grid-cols-2"><div><Label htmlFor="lot-member">Member</Label><Select id="lot-member" name="memberId" value={memberId} onChange={(event) => chooseMember(event.target.value)} required>{members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</Select></div><div><Label htmlFor="lot-type">Investment type</Label><Select id="lot-type" name="assetType" value={assetType} onChange={(event) => chooseAssetType(event.target.value as AssetType)}><option value="stock">Stock / ETF</option><option value="mutual_fund">Mutual fund</option><option value="sgb">Sovereign gold bond</option><option value="gold">Physical gold</option></Select></div><div className="relative sm:col-span-2"><Label htmlFor="lot-ticker">{fund ? "AMFI scheme code or ISIN" : gold ? "Gold purity" : sgb ? "NSE SGB symbol" : "Market ticker"}</Label>{gold ? <Select id="lot-ticker" name="ticker" value={ticker} onChange={(event) => setTicker(event.target.value)}><option value="GOLD-24K">24K / 999 gold</option><option value="GOLD-22K">22K / 916 gold</option><option value="GOLD-18K">18K / 750 gold</option></Select> : <Input id="lot-ticker" name="ticker" value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase())} required placeholder={fund ? "INF879O01027" : sgb ? "SGBFEB32IV" : "RELIANCE.NS"} autoComplete="off" />}{searchable && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border bg-[var(--surface)] shadow-xl">{search.data?.slice(0, 7).map((row) => <button type="button" onClick={() => choose(row)} key={row.ticker} className="block w-full px-3 py-2 text-left text-xs hover:bg-[var(--surface-2)]"><b>{row.ticker}</b> · {row.name}</button>)}</div>}</div><input type="hidden" name="exchange" value={exchange} /><div><Label htmlFor="lot-company">{fund ? "Scheme name" : gold ? "Description" : sgb ? "Bond series name" : "Company name"}</Label><Input id="lot-company" name="companyName" placeholder={fund ? "Fund house – scheme – plan" : gold ? "Family physical gold" : sgb ? "Sovereign Gold Bond 2032 Series IV" : "Reliance Industries"} /></div><div><Label htmlFor="lot-broker">Broker / account</Label><Input id="lot-broker" name="broker" list="lot-broker-options" value={broker} onChange={(event) => setBroker(event.target.value)} placeholder="Choose or type a broker" /><BrokerOptions id="lot-broker-options" /></div><div><Label htmlFor="lot-qty">{quantityLabel}</Label><Input id="lot-qty" name="quantity" type="number" min="0.00000001" step="any" required /></div><div><Label htmlFor="lot-price">{priceLabel}</Label><Input id="lot-price" name="buyPrice" type="number" min="0.00000001" step="any" required /></div><Button variant="primary" className="sm:col-span-2" disabled={pending}>{pending ? "Saving…" : "Create acquisition lot"}</Button></form></DialogContent></Dialog>;
}
