"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, FileSpreadsheet, LoaderCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import { bulkImportValidatedHoldings, createAcquisitionLot } from "@/app/actions/portfolio";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { BrokerOptions } from "@/components/holdings/broker-options";
import { parseImportNumber, type ImportedAssetType } from "@/lib/import/portfolio-parser";
import { assetTypeLabel } from "@/lib/portfolio/assets";
import type { FamilyMember, HoldingLot } from "@/types/portfolio";

type ImportTab = "csv" | "excel" | "pdf" | "manual";
type AssetTypeSelection = "auto" | ImportedAssetType;
type ImportSortKey = "investment" | "quantity" | "buyPrice" | "currentPrice" | "status";

type ParseRow = {
  rowNumber: number;
  sheetName: string;
  detectedAssetType: ImportedAssetType;
  values: Record<string, string>;
};

type ParseResult = {
  headers: string[];
  rows: ParseRow[];
  suggestions: Record<string, string>;
  uncertain: boolean;
  message: string;
  warnings: string[];
  detectedSheets: string[];
  statementDate: string | null;
  mixedAssetTypes: boolean;
};

const fields = ["ticker", "quantity", "buyPrice", "broker", "exchange", "companyName"] as const;
const labels: Record<(typeof fields)[number], string> = {
  ticker: "Ticker / scheme code",
  quantity: "Quantity / units",
  buyPrice: "Buy price / purchase NAV",
  broker: "Broker / folio",
  exchange: "Exchange / source",
  companyName: "Company / scheme name",
};

function sourceForTab(tab: ImportTab) {
  return tab === "manual" ? "manual" : tab;
}

export function ImportDialog({
  members,
  lots,
  disabled = false,
}: {
  members: FamilyMember[];
  lots: HoldingLot[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<ImportTab>("csv");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [assetType, setAssetType] = useState<AssetTypeSelection>("auto");
  const [pdfConfirmed, setPdfConfirmed] = useState(false);
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [sortKey, setSortKey] = useState<ImportSortKey>("investment");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  function resetReview() {
    setParsed(null);
    setMapping({});
    setPdfConfirmed(false);
    setSkipInvalid(false);
    setAssetType("auto");
  }

  async function parseFile(file: File) {
    setLoading(true);
    resetReview();
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/portfolio/import/parse", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Unable to parse this file.");
        return;
      }
      setParsed(data);
      setMapping(data.suggestions);
    } catch {
      toast.error("The file could not be uploaded. Check the development server and try again.");
    } finally {
      setLoading(false);
    }
  }

  const review = useMemo(() => {
    if (!parsed) return [];
    const existing = new Set(
      lots.map((lot) => [
        lot.member_id,
        lot.asset_type,
        lot.ticker,
        Number(lot.quantity),
        Number(lot.buy_price),
      ].join("|")),
    );
    const seen = new Set<string>();

    return parsed.rows.map((row) => {
      const get = (field: string) => row.values[mapping[field]] ?? "";
      const rowAssetType = assetType === "auto" ? row.detectedAssetType : assetType;
      const item = {
        ticker: get("ticker").trim().toUpperCase(),
        assetType: rowAssetType,
        quantity: parseImportNumber(get("quantity")),
        buyPrice: parseImportNumber(get("buyPrice")),
        buyDate: null,
        broker: get("broker").trim(),
        exchange: (get("exchange") || (rowAssetType === "mutual_fund" ? "MUTUAL_FUND" : rowAssetType === "gold" ? "GOLD" : rowAssetType === "sgb" ? "SGB" : "NSE")).trim().toUpperCase(),
        companyName: get("companyName").trim(),
        source: sourceForTab(tab) as "csv" | "excel" | "pdf",
      };
      const errors: string[] = [];
      if (!item.ticker) errors.push(rowAssetType === "mutual_fund" ? "Scheme code required" : "Ticker required");
      if (!(item.quantity > 0)) errors.push(rowAssetType === "mutual_fund" ? "Invalid units" : "Invalid quantity");
      if (!(item.buyPrice > 0)) errors.push(rowAssetType === "mutual_fund" ? "Invalid purchase NAV" : "Invalid price");
      const key = [
        memberId,
        rowAssetType,
        item.ticker,
        item.quantity,
        item.buyPrice,
      ].join("|");
      if (existing.has(key) || seen.has(key)) errors.push("Possible duplicate");
      seen.add(key);
      return {
        ...row,
        item,
        statementCmp: parseImportNumber(row.values["Statement CMP"]),
        errors,
      };
    });
  }, [assetType, lots, mapping, memberId, parsed, tab]);

  const sortedReview = useMemo(() => [...review].sort((left, right) => {
    const leftValue = sortKey === "investment"
      ? (left.item.assetType === "mutual_fund" ? left.item.companyName || left.item.ticker : left.item.ticker)
      : sortKey === "status"
        ? left.errors.join(",")
        : sortKey === "currentPrice"
          ? left.statementCmp
          : left.item[sortKey];
    const rightValue = sortKey === "investment"
      ? (right.item.assetType === "mutual_fund" ? right.item.companyName || right.item.ticker : right.item.ticker)
      : sortKey === "status"
        ? right.errors.join(",")
        : sortKey === "currentPrice"
          ? right.statementCmp
          : right.item[sortKey];
    const comparison = typeof leftValue === "number" && typeof rightValue === "number"
      ? (Number.isNaN(leftValue) ? Number.POSITIVE_INFINITY : leftValue)
        - (Number.isNaN(rightValue) ? Number.POSITIVE_INFINITY : rightValue)
      : String(leftValue).localeCompare(String(rightValue), "en-IN", { numeric: true, sensitivity: "base" });
    return sortDirection === "asc" ? comparison : -comparison;
  }), [review, sortDirection, sortKey]);

  const validRows = review.filter((row) => !row.errors.length);
  const invalidCount = review.length - validRows.length;
  const canImport =
    validRows.length > 0
    && !pending
    && (!parsed?.uncertain || pdfConfirmed)
    && (invalidCount === 0 || skipInvalid);

  function toggleSort(nextKey: ImportSortKey) {
    if (sortKey === nextKey) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else {
      setSortKey(nextKey);
      setSortDirection(nextKey === "investment" || nextKey === "status" ? "asc" : "desc");
    }
  }

  function sortIcon(key: ImportSortKey) {
    if (sortKey !== key) return <ArrowUpDown size={12} aria-hidden="true" />;
    return sortDirection === "asc"
      ? <ArrowUp size={12} aria-hidden="true" />
      : <ArrowDown size={12} aria-hidden="true" />;
  }

  function confirm() {
    if (!canImport) return;
    startTransition(async () => {
      const result = await bulkImportValidatedHoldings({
        memberId,
        rows: validRows.map((row) => row.item),
      });
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        resetReview();
      } else {
        toast.error(result.error);
      }
    });
  }

  function manual(form: FormData) {
    startTransition(async () => {
      const result = await createAcquisitionLot({
        memberId: form.get("memberId"),
        ticker: form.get("ticker"),
        assetType: form.get("assetType"),
        exchange: form.get("exchange"),
        companyName: form.get("companyName"),
        quantity: form.get("quantity"),
        buyPrice: form.get("buyPrice"),
        buyDate: null,
        broker: form.get("broker"),
        source: "manual",
      });
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled || !members.length}>
          <FileSpreadsheet size={17} />
          <span className="hidden sm:inline">Import portfolio</span>
          <span className="sm:hidden">Import</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogTitle>Import portfolio</DialogTitle>
        <DialogDescription>
          Detect broker statement tables, validate every holding, then confirm before acquisition lots are inserted.
        </DialogDescription>

        <div role="tablist" aria-label="Import format" className="mt-5 flex gap-1 overflow-x-auto rounded-xl bg-[var(--surface-2)] p-1">
          {(["csv", "excel", "pdf", "manual"] as const).map((value) => (
            <button
              role="tab"
              aria-selected={tab === value}
              key={value}
              onClick={() => {
                setTab(value);
                resetReview();
              }}
              className={`min-h-10 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-semibold ${
                tab === value ? "bg-[var(--surface)] shadow-sm" : "text-[var(--muted)]"
              }`}
            >
              {value === "pdf" ? "PDF statement" : value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>

        {tab === "manual" ? (
          <form action={manual} className="mt-6 grid gap-4 sm:grid-cols-2">
            <div><Label>Member</Label><Select name="memberId">{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</Select></div>
            <div><Label>Investment type</Label><Select name="assetType"><option value="stock">Stock / ETF</option><option value="mutual_fund">Mutual fund</option><option value="sgb">Sovereign gold bond</option><option value="gold">Physical gold</option></Select></div>
            <div><Label>Ticker / scheme / gold purity</Label><Input name="ticker" placeholder="RELIANCE.NS, ISIN, SGBFEB32IV, or GOLD-24K" required /></div>
            <div><Label>Exchange / source</Label><Select name="exchange"><option>NSE</option><option>BSE</option><option>MUTUAL_FUND</option><option>SGB</option><option>GOLD</option><option>NASDAQ</option><option>NYSE</option></Select></div>
            <div><Label>Company / scheme</Label><Input name="companyName" /></div>
            <div><Label>Quantity / units</Label><Input name="quantity" type="number" step="any" min="0.00000001" required /></div>
            <div><Label>Buy price / purchase NAV</Label><Input name="buyPrice" type="number" step="any" min="0.00000001" required /></div>
            <div><Label>Broker / folio / custody</Label><Input name="broker" list="import-broker-options" /><BrokerOptions id="import-broker-options" /></div>
            <Button variant="primary" className="sm:col-span-2" disabled={pending}>{pending ? "Saving…" : "Add acquisition lot"}</Button>
          </form>
        ) : (
          <div className="mt-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>Assign all rows to</Label>
                <Select value={memberId} onChange={(event) => setMemberId(event.target.value)}>
                  {members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}
                </Select>
              </div>
              <div>
                <Label>Investment type</Label>
                <Select value={assetType} onChange={(event) => setAssetType(event.target.value as AssetTypeSelection)}>
                  <option value="auto">Detect per sheet / row</option>
                  <option value="stock">Treat all as stocks / ETFs</option>
                  <option value="mutual_fund">Treat all as mutual funds</option>
                  <option value="sgb">Treat all as sovereign gold bonds</option>
                  <option value="gold">Treat all as physical gold</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="portfolio-file">{tab.toUpperCase()} file</Label>
                <label
                  htmlFor="portfolio-file"
                  className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--accent)] bg-[var(--accent-wash)] text-sm font-semibold text-[var(--accent-strong)]"
                >
                  <Upload size={17} />
                  {loading ? "Extracting…" : "Choose file"}
                </label>
                <input
                  id="portfolio-file"
                  className="sr-only"
                  type="file"
                  accept={tab === "csv" ? ".csv,text/csv" : tab === "excel" ? ".xlsx,.xls" : ".pdf,application/pdf"}
                  onChange={(event) => event.target.files?.[0] && parseFile(event.target.files[0])}
                />
              </div>
            </div>

            {loading && (
              <div className="mt-8 flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
                <LoaderCircle className="animate-spin" /> Parsing securely on the server…
              </div>
            )}

            {parsed && (
              <>
                <div className={`mt-5 rounded-xl p-4 text-sm ${parsed.uncertain ? "bg-amber-50 text-amber-950" : "bg-emerald-50 text-emerald-950"}`}>
                  <p className="font-semibold">{parsed.message}</p>
                  {parsed.detectedSheets.length > 0 && <p className="mt-1">Data sheets: {parsed.detectedSheets.join(", ")}</p>}
                </div>

                {parsed.warnings.length > 0 && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-950">
                    <div className="flex items-center gap-2 font-semibold"><AlertTriangle size={17} /> Review before importing</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {parsed.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                    </ul>
                  </div>
                )}

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {fields.map((field) => (
                    <div key={field}>
                      <Label>{labels[field]}</Label>
                      <Select
                        value={mapping[field] ?? ""}
                        onChange={(event) => setMapping((current) => ({ ...current, [field]: event.target.value }))}
                      >
                        <option value="">Not mapped</option>
                        {parsed.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                      </Select>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">{validRows.length} valid</span>
                  <span className="rounded-full bg-red-50 px-3 py-1 font-semibold text-red-800">{invalidCount} need attention</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">{review.length} rows previewed</span>
                  {parsed.mixedAssetTypes && <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-800">Multiple asset types detected</span>}
                </div>

                <div className="mt-4 max-h-72 overflow-auto rounded-xl border">
                  <table className="w-full min-w-[920px] text-left text-xs">
                    <thead className="sticky top-0 bg-[var(--surface-2)]">
                      <tr>
                        <th className="p-3">Sheet / row</th>
                        <th>Type</th>
                        {([
                          ["investment", "Investment"],
                          ["quantity", "Quantity"],
                          ["buyPrice", "Average cost"],
                          ["currentPrice", "Statement CMP"],
                          ["status", "Status"],
                        ] as const).map(([key, label]) => (
                          <th key={key} aria-sort={sortKey === key ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                            <button className="inline-flex min-h-10 items-center gap-1 font-semibold" type="button" onClick={() => toggleSort(key)}>
                              {label}{sortIcon(key)}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedReview.slice(0, 200).map((row) => (
                        <tr key={`${row.sheetName}-${row.rowNumber}`} className="border-t">
                          <td className="p-3">{row.sheetName} · {row.rowNumber}</td>
                          <td>{assetTypeLabel(row.item.assetType)}</td>
                          <td>
                            <span className="font-semibold">{row.item.assetType === "mutual_fund" ? row.item.companyName || row.item.ticker : row.item.ticker || "—"}</span>
                            {row.item.assetType === "mutual_fund" && row.item.companyName && <span className="block text-[10px] text-[var(--muted)]">ISIN / code: {row.item.ticker}</span>}
                          </td>
                          <td>{Number.isFinite(row.item.quantity) ? row.item.quantity : "—"}</td>
                          <td>{Number.isFinite(row.item.buyPrice) ? row.item.buyPrice : "—"}</td>
                          <td>{Number.isFinite(row.statementCmp) ? row.statementCmp : "—"}</td>
                          <td className={row.errors.length ? "text-red-700" : "text-emerald-700"}>{row.errors.join(", ") || "Ready"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {parsed.uncertain && (
                  <label className="mt-4 flex min-h-11 items-start gap-3 rounded-xl border p-3 text-sm">
                    <input className="mt-1 size-4" type="checkbox" checked={pdfConfirmed} onChange={(event) => setPdfConfirmed(event.target.checked)} />
                    <span>I reviewed the PDF extraction against the original statement and confirm the displayed values are correct.</span>
                  </label>
                )}
                {invalidCount > 0 && (
                  <label className="mt-3 flex min-h-11 items-start gap-3 rounded-xl border p-3 text-sm">
                    <input className="mt-1 size-4" type="checkbox" checked={skipInvalid} onChange={(event) => setSkipInvalid(event.target.checked)} />
                    <span>Import the {validRows.length} valid rows and skip the {invalidCount} rows marked above.</span>
                  </label>
                )}

                <Button variant="primary" className="mt-5 w-full" onClick={confirm} disabled={!canImport}>
                  {pending ? "Importing…" : `Confirm import of ${validRows.length} acquisition lots`}
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
