import { z } from "zod";

const ticker = z.string().trim().min(1).max(24).transform((value) => value.toUpperCase());
const exchange = z.string().trim().min(1).max(16).transform((value) => value.toUpperCase());
const date = z.iso.date();
const id = z.uuid();
const optionalDate = z.preprocess((value) => value === "" || value == null ? null : value, date.nullable());

export const memberSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(1).max(80),
  defaultBroker: z.string().trim().max(100).optional().nullable(),
});

export const lotSchema = z.object({
  id: id.optional(),
  memberId: id,
  ticker,
  assetType: z.enum(["stock", "mutual_fund", "sgb", "gold"]).default("stock"),
  exchange,
  companyName: z.string().trim().max(160).optional().nullable(),
  quantity: z.coerce.number().positive().finite(),
  buyPrice: z.coerce.number().positive().finite(),
  buyDate: optionalDate.optional().default(null),
  broker: z.string().trim().max(100).optional().nullable(),
  source: z.enum(["manual", "csv", "excel", "pdf"]).default("manual"),
});

export const sellSchema = z.object({
  memberId: id,
  holdingId: id,
  quantity: z.coerce.number().positive().finite(),
  sellPrice: z.coerce.number().positive().finite(),
  sellDate: date,
  fees: z.coerce.number().min(0).finite().default(0),
  taxTag: z.enum(["Short-Term", "Long-Term"]),
});

export const bulkImportSchema = z.object({
  memberId: id,
  rows: z.array(lotSchema.omit({ memberId: true, id: true })).min(1).max(2000),
});

export const viewFilterSchema = z.object({ memberId: id.optional().nullable() });

export type LotInput = z.input<typeof lotSchema>;
export type SellInput = z.input<typeof sellSchema>;
