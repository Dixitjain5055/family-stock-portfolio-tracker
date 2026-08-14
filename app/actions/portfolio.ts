"use server";

import { revalidatePath } from "next/cache";
import { aggregateLots, summarizePortfolio } from "@/lib/portfolio/calculations";
import { getPortfolioMarketQuotes } from "@/lib/market/amfi";
import { requireUser, ownsMember } from "@/lib/supabase/auth";
import { bulkImportSchema, lotSchema, memberSchema, sellSchema, viewFilterSchema } from "@/lib/validation/portfolio";
import type { ActionResult, ExitedTrade, FamilyMember, HoldingLot, PortfolioSummary } from "@/types/portfolio";
import type { z } from "zod";

function validationError(error: z.ZodError): ActionResult {
  return { ok: false, error: "Please correct the highlighted fields.", fieldErrors: error.flatten().fieldErrors as Record<string, string[]> };
}

function legacyAssetCompatibility<T extends { asset_type: string; exchange: string }>(payload: T): T {
  if (payload.asset_type === "gold") return { ...payload, asset_type: "stock", exchange: "GOLD" };
  if (payload.asset_type === "sgb") return { ...payload, asset_type: "stock", exchange: "SGB" };
  return payload;
}

export async function addFamilyMember(input: unknown): Promise<ActionResult<FamilyMember>> {
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.from("family_members").insert({
      user_id: user.id, name: parsed.data.name, default_broker: parsed.data.defaultBroker || null,
    }).select().single();
    if (error) throw error;
    revalidatePath("/dashboard");
    return { ok: true, data: data as FamilyMember, message: "Family member added." };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to add member." }; }
}

export async function editFamilyMember(input: unknown): Promise<ActionResult<FamilyMember>> {
  const parsed = memberSchema.required({ id: true }).safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.from("family_members").update({
      name: parsed.data.name, default_broker: parsed.data.defaultBroker || null,
    }).eq("id", parsed.data.id).eq("user_id", user.id).select().single();
    if (error) throw error;
    revalidatePath("/dashboard");
    return { ok: true, data: data as FamilyMember, message: "Member updated." };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to update member." }; }
}

export async function removeFamilyMember(memberId: string): Promise<ActionResult> {
  try {
    const parsed = memberSchema.shape.id.unwrap().parse(memberId);
    const { supabase, user } = await requireUser();
    const { error } = await supabase.from("family_members").delete().eq("id", parsed).eq("user_id", user.id);
    if (error) throw error;
    revalidatePath("/dashboard");
    return { ok: true, message: "Member and their portfolio were removed." };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to remove member." }; }
}

export async function createAcquisitionLot(input: unknown): Promise<ActionResult<HoldingLot>> {
  const parsed = lotSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { supabase, owns } = await ownsMember(parsed.data.memberId);
    if (!owns) return { ok: false, error: "You do not own the selected member." };
    const payload = {
      member_id: parsed.data.memberId, ticker: parsed.data.ticker, asset_type: parsed.data.assetType, exchange: parsed.data.exchange,
      company_name: parsed.data.companyName || null, quantity: parsed.data.quantity,
      remaining_quantity: parsed.data.quantity, buy_price: parsed.data.buyPrice,
      adjusted_buy_price: parsed.data.buyPrice, buy_date: parsed.data.buyDate,
      broker: parsed.data.broker || null, source: parsed.data.source,
    };
    let { data, error } = await supabase.from("holdings").insert(payload).select().single();
    if (error?.code === "23514" && error.message.includes("asset_type")) {
      ({ data, error } = await supabase.from("holdings").insert(legacyAssetCompatibility(payload)).select().single());
    }
    if (error?.code === "23502" && error.message.includes("buy_date") && parsed.data.buyDate == null) {
      ({ data, error } = await supabase.from("holdings").insert({
        ...legacyAssetCompatibility(payload),
        buy_date: new Date().toISOString().slice(0, 10),
      }).select().single());
    }
    if (error) throw error;
    revalidatePath("/dashboard");
    return { ok: true, data: data as HoldingLot, message: "Acquisition lot created." };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to create lot." }; }
}

export async function addMoreQuantity(input: unknown) { return createAcquisitionLot(input); }

export async function editAcquisitionLot(input: unknown): Promise<ActionResult<HoldingLot>> {
  const parsed = lotSchema.required({ id: true }).safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { supabase, owns } = await ownsMember(parsed.data.memberId);
    if (!owns) return { ok: false, error: "You do not own the selected member." };
    const { data: current } = await supabase.from("holdings").select("quantity,remaining_quantity").eq("id", parsed.data.id).single();
    if (!current) return { ok: false, error: "Acquisition lot not found." };
    const sold = Number(current.quantity) - Number(current.remaining_quantity);
    if (parsed.data.quantity < sold) return { ok: false, error: `Quantity cannot be less than the ${sold} shares already sold.` };
    const payload = {
      member_id: parsed.data.memberId, ticker: parsed.data.ticker, asset_type: parsed.data.assetType, exchange: parsed.data.exchange,
      company_name: parsed.data.companyName || null, quantity: parsed.data.quantity,
      remaining_quantity: parsed.data.quantity - sold, buy_price: parsed.data.buyPrice,
      adjusted_buy_price: parsed.data.buyPrice, buy_date: parsed.data.buyDate,
      broker: parsed.data.broker || null,
      status: parsed.data.quantity - sold === 0 ? "closed" : "open",
    };
    let { data, error } = await supabase.from("holdings").update(payload).eq("id", parsed.data.id).select().single();
    if (error?.code === "23514" && error.message.includes("asset_type")) {
      ({ data, error } = await supabase.from("holdings").update(legacyAssetCompatibility(payload)).eq("id", parsed.data.id).select().single());
    }
    if (error) throw error;
    revalidatePath("/dashboard");
    return { ok: true, data: data as HoldingLot, message: "Acquisition lot updated." };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to edit lot." }; }
}

export async function bulkImportValidatedHoldings(input: unknown): Promise<ActionResult<{ inserted: number }>> {
  const parsed = bulkImportSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { supabase, owns } = await ownsMember(parsed.data.memberId);
    if (!owns) return { ok: false, error: "You do not own the selected member." };
    const rows = parsed.data.rows.map((row) => ({ member_id: parsed.data.memberId, ticker: row.ticker, asset_type: row.assetType,
      exchange: row.exchange, company_name: row.companyName || null, quantity: row.quantity,
      remaining_quantity: row.quantity, buy_price: row.buyPrice, adjusted_buy_price: row.buyPrice,
      buy_date: row.buyDate, broker: row.broker || null, source: row.source }));
    let { error } = await supabase.from("holdings").insert(rows);
    if (error?.code === "23514" && error.message.includes("asset_type")) {
      ({ error } = await supabase.from("holdings").insert(rows.map(legacyAssetCompatibility)));
    }
    if (error?.code === "23502" && error.message.includes("buy_date")) {
      const compatibilityDate = new Date().toISOString().slice(0, 10);
      ({ error } = await supabase.from("holdings").insert(
        rows.map((row) => ({ ...legacyAssetCompatibility(row), buy_date: row.buy_date ?? compatibilityDate })),
      ));
    }
    if (error) throw error;
    revalidatePath("/dashboard");
    return { ok: true, data: { inserted: rows.length }, message: `${rows.length} acquisition lots imported.` };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Import failed." }; }
}

export async function sellLot(input: unknown): Promise<ActionResult<ExitedTrade>> {
  const parsed = sellSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { supabase, owns } = await ownsMember(parsed.data.memberId);
    if (!owns) return { ok: false, error: "You do not own the selected member." };
    let { data, error } = await supabase.rpc("sell_holding_lot", {
      p_holding_id: parsed.data.holdingId, p_member_id: parsed.data.memberId,
      p_quantity: parsed.data.quantity, p_sell_price: parsed.data.sellPrice,
      p_sell_date: parsed.data.sellDate, p_fees: parsed.data.fees,
      p_tax_tag: parsed.data.taxTag,
    });
    if (error?.code === "PGRST202" || error?.message.includes("p_tax_tag")) {
      ({ data, error } = await supabase.rpc("sell_holding_lot", {
        p_holding_id: parsed.data.holdingId, p_member_id: parsed.data.memberId,
        p_quantity: parsed.data.quantity, p_sell_price: parsed.data.sellPrice,
        p_sell_date: parsed.data.sellDate, p_fees: parsed.data.fees,
        p_holding_period_days: parsed.data.taxTag === "Short-Term" ? 1_000_000 : -1,
      }));
    }
    if (error) throw error;
    revalidatePath("/dashboard");
    return { ok: true, data: data as ExitedTrade, message: "Sale recorded atomically." };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to record sale." }; }
}

export async function fetchFilteredPortfolioSummary(input: unknown): Promise<ActionResult<PortfolioSummary>> {
  const parsed = viewFilterSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { supabase, user } = await requireUser();
    let query = supabase.from("holdings").select("*,family_members!inner(id,name,default_broker,user_id)")
      .eq("family_members.user_id", user.id).gt("remaining_quantity", 0);
    if (parsed.data.memberId) query = query.eq("member_id", parsed.data.memberId);
    const [{ data: lots, error }, { data: trades }] = await Promise.all([
      query, supabase.from("exited_trades").select("realized_pl,member_id,family_members!inner(user_id)").eq("family_members.user_id", user.id),
    ]);
    if (error) throw error;
    const filteredTrades = parsed.data.memberId ? trades?.filter((trade) => trade.member_id === parsed.data.memberId) : trades;
    const typedLots = (lots ?? []) as unknown as HoldingLot[];
    const quotes = await getPortfolioMarketQuotes(typedLots);
    const holdings = aggregateLots(typedLots, quotes);
    const summary = summarizePortfolio(holdings, (filteredTrades ?? []).reduce((sum, row) => sum + Number(row.realized_pl), 0));
    return { ok: true, data: summary, message: "Portfolio loaded." };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to load portfolio." }; }
}
