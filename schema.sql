-- Family Stock Portfolio Tracker — rerunnable Supabase schema
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = timezone('utc', now()); return new; end;
$$;

create or replace function public.normalize_security_fields()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.ticker = upper(trim(new.ticker));
  new.exchange = upper(trim(new.exchange));
  return new;
end;
$$;

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  default_broker text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, name)
);

create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.family_members(id) on delete cascade,
  ticker text not null check (length(trim(ticker)) between 1 and 24),
  asset_type text not null default 'stock' check (asset_type in ('stock','mutual_fund','sgb','gold')),
  exchange text not null check (length(trim(exchange)) between 1 and 16),
  company_name text,
  quantity numeric(24,8) not null check (quantity > 0),
  remaining_quantity numeric(24,8) not null check (remaining_quantity >= 0 and remaining_quantity <= quantity),
  buy_price numeric(24,8) not null check (buy_price > 0),
  adjusted_buy_price numeric(24,8) not null check (adjusted_buy_price > 0),
  buy_date date check (buy_date is null or buy_date <= current_date),
  broker text,
  source text not null default 'manual' check (source in ('manual','csv','excel','pdf')),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((remaining_quantity = 0 and status = 'closed') or (remaining_quantity > 0 and status = 'open'))
);

create table if not exists public.exited_trades (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.family_members(id) on delete cascade,
  holding_id uuid not null references public.holdings(id) on delete restrict,
  ticker text not null check (length(trim(ticker)) between 1 and 24),
  asset_type text not null default 'stock' check (asset_type in ('stock','mutual_fund','sgb','gold')),
  quantity numeric(24,8) not null check (quantity > 0),
  buy_price numeric(24,8) not null check (buy_price > 0),
  sell_price numeric(24,8) not null check (sell_price > 0),
  buy_date date,
  sell_date date not null check (buy_date is null or sell_date >= buy_date),
  fees numeric(24,8) not null default 0 check (fees >= 0),
  realized_pl numeric(24,8) not null,
  tax_tag text not null check (tax_tag in ('Short-Term','Long-Term')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.corporate_actions (
  id uuid primary key default gen_random_uuid(),
  ticker text not null check (length(trim(ticker)) between 1 and 24),
  action_type text not null check (action_type in ('split','bonus','review_required')),
  action_date date not null,
  ratio numeric(24,8) not null check (ratio > 0),
  external_event_id text not null,
  processed_at timestamptz not null default timezone('utc', now()),
  unique (ticker, action_type, action_date, external_event_id)
);
comment on table public.corporate_actions is 'Compact permanent idempotency and audit ledger only. Raw provider responses and news are never persisted.';

create index if not exists family_members_user_idx on public.family_members(user_id);
alter table public.holdings add column if not exists asset_type text not null default 'stock';
alter table public.exited_trades add column if not exists asset_type text not null default 'stock';
alter table public.holdings alter column buy_date drop not null;
alter table public.exited_trades alter column buy_date drop not null;
alter table public.holdings drop constraint if exists holdings_buy_date_check;
alter table public.holdings add constraint holdings_buy_date_check check (buy_date is null or buy_date <= current_date);
alter table public.exited_trades drop constraint if exists exited_trades_check;
alter table public.exited_trades drop constraint if exists exited_trades_sell_after_buy_check;
alter table public.exited_trades add constraint exited_trades_sell_after_buy_check
  check (buy_date is null or sell_date >= buy_date);
do $$ begin
  alter table public.holdings drop constraint if exists holdings_asset_type_check;
  alter table public.holdings add constraint holdings_asset_type_check check (asset_type in ('stock','mutual_fund','sgb','gold'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.exited_trades drop constraint if exists exited_trades_asset_type_check;
  alter table public.exited_trades add constraint exited_trades_asset_type_check check (asset_type in ('stock','mutual_fund','sgb','gold'));
exception when duplicate_object then null; end $$;
create index if not exists holdings_member_idx on public.holdings(member_id);
create index if not exists holdings_ticker_idx on public.holdings(ticker);
create index if not exists holdings_active_idx on public.holdings(member_id, ticker, buy_date) where remaining_quantity > 0;
create index if not exists holdings_asset_active_idx on public.holdings(member_id, asset_type, ticker, buy_date) where remaining_quantity > 0;
create index if not exists exited_trades_member_date_idx on public.exited_trades(member_id, sell_date desc);
create index if not exists exited_trades_ticker_idx on public.exited_trades(ticker);
create index if not exists corporate_actions_ticker_date_idx on public.corporate_actions(ticker, action_date);

drop trigger if exists family_members_updated_at on public.family_members;
create trigger family_members_updated_at before update on public.family_members
for each row execute function public.set_updated_at();
drop trigger if exists holdings_updated_at on public.holdings;
create trigger holdings_updated_at before update on public.holdings
for each row execute function public.set_updated_at();
drop trigger if exists holdings_normalize on public.holdings;
create trigger holdings_normalize before insert or update on public.holdings
for each row execute function public.normalize_security_fields();

alter table public.family_members enable row level security;
alter table public.holdings enable row level security;
alter table public.exited_trades enable row level security;
alter table public.corporate_actions enable row level security;

drop policy if exists "members_select_own" on public.family_members;
create policy "members_select_own" on public.family_members for select using (auth.uid() = user_id);
drop policy if exists "members_insert_own" on public.family_members;
create policy "members_insert_own" on public.family_members for insert with check (auth.uid() = user_id);
drop policy if exists "members_update_own" on public.family_members;
create policy "members_update_own" on public.family_members for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "members_delete_own" on public.family_members;
create policy "members_delete_own" on public.family_members for delete using (auth.uid() = user_id);

drop policy if exists "holdings_select_own" on public.holdings;
create policy "holdings_select_own" on public.holdings for select using (
  exists (select 1 from public.family_members m where m.id = member_id and m.user_id = auth.uid())
);
drop policy if exists "holdings_insert_own" on public.holdings;
create policy "holdings_insert_own" on public.holdings for insert with check (
  exists (select 1 from public.family_members m where m.id = member_id and m.user_id = auth.uid())
);
drop policy if exists "holdings_update_own" on public.holdings;
create policy "holdings_update_own" on public.holdings for update using (
  exists (select 1 from public.family_members m where m.id = member_id and m.user_id = auth.uid())
) with check (exists (select 1 from public.family_members m where m.id = member_id and m.user_id = auth.uid()));
drop policy if exists "holdings_delete_own" on public.holdings;
create policy "holdings_delete_own" on public.holdings for delete using (
  exists (select 1 from public.family_members m where m.id = member_id and m.user_id = auth.uid())
);

drop policy if exists "trades_select_own" on public.exited_trades;
create policy "trades_select_own" on public.exited_trades for select using (
  exists (select 1 from public.family_members m where m.id = member_id and m.user_id = auth.uid())
);
drop policy if exists "corporate_actions_authenticated_read" on public.corporate_actions;
create policy "corporate_actions_authenticated_read" on public.corporate_actions for select to authenticated using (true);

create or replace view public.active_portfolio_lots with (security_invoker = true) as
select h.*, m.user_id, m.name as member_name
from public.holdings h join public.family_members m on m.id = h.member_id
where h.remaining_quantity > 0;

drop function if exists public.portfolio_aggregation(uuid);
create function public.portfolio_aggregation(p_member_id uuid default null)
returns table (
  ticker text, asset_type text, exchange text, company_name text, total_quantity numeric,
  weighted_average_price numeric, total_invested numeric, owner_count bigint
) language sql stable security invoker set search_path = public as $$
  select h.ticker, h.asset_type, min(h.exchange), min(coalesce(h.company_name, h.ticker)),
    sum(h.remaining_quantity),
    sum(h.remaining_quantity * h.adjusted_buy_price) / nullif(sum(h.remaining_quantity), 0),
    sum(h.remaining_quantity * h.adjusted_buy_price), count(distinct h.member_id)
  from public.holdings h join public.family_members m on m.id = h.member_id
  where m.user_id = auth.uid() and h.remaining_quantity > 0
    and (p_member_id is null or h.member_id = p_member_id)
  group by h.ticker, h.asset_type;
$$;

drop function if exists public.sell_holding_lot(uuid,uuid,numeric,numeric,date,numeric,integer);
drop function if exists public.sell_holding_lot(uuid,uuid,numeric,numeric,date,numeric,text);
create function public.sell_holding_lot(
  p_holding_id uuid, p_member_id uuid, p_quantity numeric, p_sell_price numeric,
  p_sell_date date, p_fees numeric, p_tax_tag text
) returns public.exited_trades
language plpgsql security invoker set search_path = public as $$
declare lot public.holdings; trade public.exited_trades; new_remaining numeric; tag text;
begin
  if p_quantity <= 0 or p_sell_price <= 0 or p_fees < 0 then raise exception 'Invalid sale values'; end if;
  if p_tax_tag not in ('Short-Term','Long-Term') then raise exception 'Choose a valid holding period'; end if;
  select h.* into lot from public.holdings h join public.family_members m on m.id = h.member_id
    where h.id = p_holding_id and h.member_id = p_member_id and m.user_id = auth.uid() for update of h;
  if not found then raise exception 'Holding not found or forbidden'; end if;
  if p_quantity > lot.remaining_quantity then raise exception 'Sale quantity exceeds remaining quantity'; end if;
  if lot.buy_date is not null and p_sell_date < lot.buy_date then raise exception 'Sell date cannot precede buy date'; end if;
  new_remaining := lot.remaining_quantity - p_quantity;
  tag := p_tax_tag;
  update public.holdings set remaining_quantity = new_remaining,
    status = case when new_remaining = 0 then 'closed' else 'open' end where id = lot.id;
  insert into public.exited_trades(member_id, holding_id, ticker, asset_type, quantity, buy_price, sell_price,
    buy_date, sell_date, fees, realized_pl, tax_tag)
  values(lot.member_id, lot.id, lot.ticker, lot.asset_type, p_quantity, lot.adjusted_buy_price, p_sell_price,
    lot.buy_date, p_sell_date, p_fees, (p_sell_price-lot.adjusted_buy_price)*p_quantity-p_fees, tag)
  returning * into trade;
  return trade;
end;
$$;

create or replace function public.apply_corporate_action(
  p_ticker text, p_action_type text, p_action_date date, p_ratio numeric, p_external_event_id text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare action_id uuid; affected integer := 0;
begin
  if p_ratio <= 0 or p_action_type not in ('split','bonus') then raise exception 'Unsupported corporate action'; end if;
  insert into public.corporate_actions(ticker, action_type, action_date, ratio, external_event_id)
  values(upper(trim(p_ticker)), p_action_type, p_action_date, p_ratio, p_external_event_id)
  on conflict (ticker, action_type, action_date, external_event_id) do nothing returning id into action_id;
  if action_id is null then return jsonb_build_object('status','skipped','affected',0); end if;
  update public.holdings set quantity = quantity * p_ratio,
    remaining_quantity = remaining_quantity * p_ratio,
    adjusted_buy_price = adjusted_buy_price / p_ratio
  where ticker = upper(trim(p_ticker)) and asset_type = 'stock' and exchange not in ('GOLD','SGB')
    and ((buy_date is not null and buy_date <= p_action_date)
      or (buy_date is null and created_at::date <= p_action_date));
  get diagnostics affected = row_count;
  return jsonb_build_object('status','processed','affected',affected,'action_id',action_id);
end;
$$;
revoke all on function public.apply_corporate_action(text,text,date,numeric,text) from public, anon, authenticated;
grant execute on function public.apply_corporate_action(text,text,date,numeric,text) to service_role;

grant select, insert, update, delete on public.family_members, public.holdings to authenticated;
grant select on public.exited_trades, public.corporate_actions, public.active_portfolio_lots to authenticated;
grant execute on function public.portfolio_aggregation(uuid), public.sell_holding_lot(uuid,uuid,numeric,numeric,date,numeric,text) to authenticated;
