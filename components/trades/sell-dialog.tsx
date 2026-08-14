"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { sellLot } from "@/app/actions/portfolio";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import type { AggregatedHolding, HoldingLot } from "@/types/portfolio";

export function SellDialog({
  holding,
  open,
  onOpenChange,
}: {
  holding: AggregatedHolding | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const lots = useMemo(() => holding?.owners.flatMap((owner) => owner.lots) ?? [], [holding]);
  const [lotId, setLotId] = useState("");
  const [pending, startTransition] = useTransition();
  const selected = lots.find((lot) => lot.id === (lotId || lots[0]?.id));
  const unit = holding?.assetType === "mutual_fund" ? "units" : "shares";
  const displayName = holding?.assetType === "mutual_fund"
    ? holding.companyName || holding.ticker
    : holding?.ticker;

  function submit(form: FormData) {
    if (!selected) return;
    startTransition(async () => {
      const result = await sellLot({
        memberId: selected.member_id,
        holdingId: selected.id,
        quantity: form.get("quantity"),
        sellPrice: form.get("sellPrice"),
        sellDate: form.get("sellDate"),
        fees: form.get("fees") || 0,
        taxTag: form.get("taxTag"),
      });
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{holding?.assetType === "mutual_fund" ? "Redeem" : "Sell"} {displayName}</DialogTitle>
        <DialogDescription>
          Select one member lot. Quantity, realized profit, and history are committed in one database transaction.
        </DialogDescription>
        {lots.length ? (
          <form action={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="sale-lot">Member lot</Label>
              <Select id="sale-lot" value={lotId || lots[0]?.id} onChange={(event) => setLotId(event.target.value)}>
                {lots.map((lot: HoldingLot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.family_members?.name} · {lot.remaining_quantity} {unit} · {formatCurrency(lot.adjusted_buy_price)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="sale-qty">Quantity (max {selected?.remaining_quantity})</Label>
              <Input id="sale-qty" name="quantity" type="number" step="any" min="0.00000001" max={selected?.remaining_quantity} required />
            </div>
            <div>
              <Label htmlFor="sale-price">{holding?.assetType === "mutual_fund" ? "Redemption NAV" : "Sell price"}</Label>
              <Input id="sale-price" name="sellPrice" type="number" step="any" min="0.00000001" required />
            </div>
            <div>
              <Label htmlFor="sale-date">Sale date</Label>
              <Input
                id="sale-date"
                name="sellDate"
                type="date"
                min={selected?.buy_date ?? undefined}
                max={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
            <div>
              <Label htmlFor="sale-fees">Fees</Label>
              <Input id="sale-fees" name="fees" type="number" step="any" min="0" defaultValue="0" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="sale-tax-tag">Holding period for this sale</Label>
              <Select id="sale-tax-tag" name="taxTag" defaultValue="" required>
                <option value="" disabled>Choose Short-Term or Long-Term</option>
                <option value="Short-Term">Short-Term</option>
                <option value="Long-Term">Long-Term</option>
              </Select>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                Choose from your broker or tax records. This label is recorded as an estimate and is not tax advice.
              </p>
            </div>
            <Button variant="danger" className="sm:col-span-2" disabled={pending}>
              {pending ? "Recording sale…" : "Confirm sale"}
            </Button>
          </form>
        ) : (
          <p className="mt-6 text-sm text-[var(--muted)]">No open lots are available.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
