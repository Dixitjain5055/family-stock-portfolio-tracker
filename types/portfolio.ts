export type FamilyMember = {
  id: string;
  user_id: string;
  name: string;
  default_broker: string | null;
  created_at: string;
  updated_at: string;
};

export type AssetType = "stock" | "mutual_fund" | "sgb" | "gold";

export type HoldingLot = {
  id: string;
  member_id: string;
  ticker: string;
  asset_type: AssetType;
  exchange: string;
  company_name: string | null;
  quantity: number;
  remaining_quantity: number;
  buy_price: number;
  adjusted_buy_price: number;
  buy_date: string | null;
  broker: string | null;
  source: string;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
  family_members?: Pick<FamilyMember, "id" | "name" | "default_broker">;
};

export type ExitedTrade = {
  id: string;
  member_id: string;
  holding_id: string;
  ticker: string;
  asset_type?: AssetType;
  quantity: number;
  buy_price: number;
  sell_price: number;
  buy_date: string | null;
  sell_date: string;
  fees: number;
  realized_pl: number;
  tax_tag: "Short-Term" | "Long-Term";
  created_at: string;
  family_members?: Pick<FamilyMember, "name">;
};

export type MarketQuote = {
  ticker: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string | null;
  marketTime: string | null;
  sector: string | null;
  marketCap: number | null;
  stale: boolean;
  instrumentType?: string;
  error?: string;
};

export type MemberBreakdown = {
  memberId: string;
  memberName: string;
  quantity: number;
  averagePrice: number;
  invested: number;
  brokers: string[];
  lots: HoldingLot[];
};

export type AggregatedHolding = {
  ticker: string;
  assetType: AssetType;
  exchange: string;
  companyName: string;
  quantity: number;
  averagePrice: number;
  invested: number;
  currentPrice: number | null;
  currentValue: number | null;
  unrealizedPl: number | null;
  unrealizedPlPercent: number | null;
  dayChange: number | null;
  dayChangePercent: number | null;
  valuationFallback: boolean;
  owners: MemberBreakdown[];
  quote: MarketQuote | null;
};

export type PortfolioSummary = {
  holdings: AggregatedHolding[];
  totalValue: number | null;
  totalInvested: number;
  unrealizedPl: number | null;
  unrealizedPlPercent: number | null;
  dayChange: number | null;
  dayChangePercent: number | null;
  dayChangeCoverage: number;
  realizedPl: number;
  lastRefresh: string | null;
  partialMarketData: boolean;
};

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
