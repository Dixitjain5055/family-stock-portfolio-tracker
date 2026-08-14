# Kinfolio — Family Stock Portfolio Tracker

Kinfolio is a production-oriented Next.js App Router application for tracking a family’s stock holdings without losing member-level ownership or acquisition-lot history. Shared tickers consolidate into one quantity-weighted family position and expand back to exact members and lots for editing or selling.

It also tracks mutual funds, sovereign gold bonds, and physical gold as distinct asset types. Mutual-fund lots store units and purchase NAV, SGB lots store bond units, and physical gold stores weight in grams with 24K/22K/18K purity.

The All Family view is a consolidated household dashboard with member drill-down, asset allocation, and shared-position ownership. Selecting a member switches to a personal dashboard with only that member's KPIs, holdings, transaction history, charts, and alerts. Live dashboards refresh server-fetched quotes every 60 seconds. Mutual-fund NAV freshness is reported separately from live/stale stock counts.

Equities and mutual funds have separate dashboard ledgers. The mutual-fund section shows scheme-level units, weighted purchase NAV, current NAV and freshness, invested/current values, return, member ownership, and exact acquisition-lot counts. A redemption always resolves to one member and one lot.

## Stack

- Next.js 16 (compatible with the requested Next.js 14+), React 19, TypeScript, Tailwind CSS, Shadcn-style Radix primitives, Lucide, Framer Motion, Recharts, and TanStack Query
- Supabase PostgreSQL, Auth, Row Level Security, `@supabase/supabase-js`, and `@supabase/ssr`
- Server-only market adapters for Yahoo Finance equities, AMFI mutual-fund NAV, BSE-listed SGB quotes, and physical-gold reference pricing; CSV/Excel/PDF parsing with Papa Parse, SheetJS, and `pdf-parse`
- Vercel deployment and Vercel Cron

The app opens a clearly labeled, read-only sample dashboard when Supabase is not configured. No sample value is used in the authenticated live path.

Set `AUTH_DISABLED=true` for a single-tenant installation without a login screen. In that mode, `PORTFOLIO_OWNER_ID` scopes every server query and mutation to one internal Supabase user and the service-role key remains server-only. Anyone who can reach the deployed URL can access that portfolio, so do not publish this mode unless that unrestricted access is intentional.

The standard `AUTH_DISABLED=false` mode offers email/password sign-in, account creation, passwordless email links, and dashboard sign-out. Supabase RLS isolates every account's members, holdings, and trades.

## Local setup

Requirements: Node.js 22+ (required by the current `yahoo-finance2`) and npm.

```bash
npm install
copy .env.example .env.local
npm run dev
```

On macOS/Linux, use `cp .env.example .env.local`. Open `http://localhost:3000`. Useful commands:

```bash
npm run dev        # development server
npm run lint       # ESLint
npm run typecheck  # strict TypeScript check
npm test           # calculation tests
npm run check      # lint + typecheck + tests
npm run build      # production build
npm start          # run the production build
```

## Supabase initialization

1. Create a Supabase project.
2. Open the SQL Editor, paste the complete root [`schema.sql`](./schema.sql), and run it. The script is safe to rerun: extensions, tables, indexes, policies, triggers, views, and functions use idempotent creation/replacement patterns.
3. For multi-user mode, configure the Auth callback URLs and enable email OTP/magic-link authentication.
4. For no-login mode, create one internal Supabase user, set its UUID as `PORTFOLIO_OWNER_ID`, and set `AUTH_DISABLED=true`.
5. Copy the project URL and keys into `.env.local`, then restart Next.js.

The schema enables RLS on every user-facing table. Policies derive access through `family_members.user_id = auth.uid()`. The sale RPC uses the authenticated session and locks the selected holding row. The corporate-action RPC is executable only by the Supabase service role.

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL; safe for the browser
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anonymous/publishable key; safe for the browser
SUPABASE_SERVICE_ROLE_KEY=       # server only; never prefix with NEXT_PUBLIC_
CRON_SECRET=                     # long random secret for cron and corporate-action mutation routes
AUTH_DISABLED=false              # true enables no-login, single-tenant mode
PORTFOLIO_OWNER_ID=              # internal auth.users UUID used by single-tenant mode
```

Never commit `.env.local`. The service-role key is imported only by `lib/supabase/admin.ts`, which is marked `server-only`.

## Portfolio behavior

- Every purchase creates an acquisition lot. “Add more” must create another lot rather than changing an old purchase.
- Mutual-fund purchases use `asset_type = 'mutual_fund'`, quantity as units, and buy price as purchase NAV. Fund schemes are excluded from stock split and stock-dividend processing.
- SGB purchases use `asset_type = 'sgb'`; broker suffixes such as `-GB` are removed before matching the BSE active-debt list.
- Physical gold uses `asset_type = 'gold'`, quantity in grams, purity tickers `GOLD-24K`, `GOLD-22K`, or `GOLD-18K`, and per-gram acquisition cost.
- Active quantity uses `remaining_quantity`.
- Weighted average is `sum(remaining quantity × adjusted buy price) / sum(remaining quantity)`; a simple average is never used.
- A combined ticker appears once and retains member and lot breakdowns.
- Partial/full sales call `sell_holding_lot`, which locks the chosen lot, rejects overselling, updates remaining quantity, closes empty lots, and inserts realized history in one PostgreSQL transaction.
- Acquisition dates are optional because balance statements commonly omit them. Every sale requires the user to choose Short-Term or Long-Term explicitly; the recorded label is an estimate, not tax advice.
- Confirmed split events call the service-role-only `apply_corporate_action` RPC. Its event uniqueness key prevents repeat application. Unsupported bonus-like events are not inferred.

## Import formats

Maximum upload size is 8 MB; each detected table is capped at 2,000 candidate rows and bulk insertion at 2,000 validated rows per action.

### CSV / Excel

The importer scans the first 100 rows of every worksheet for a recognizable holdings table, so broker titles, valuation summaries, and blank preambles may appear before the column headers. When a workbook contains dedicated Equity and Mutual Funds sheets plus a repeated Combined/Consolidated sheet, the dedicated sheets are used and the repeated sheet is skipped. The preview shows the original sheet and row for every holding.

Supported automatic headers include:

| Target | Recognized examples |
| --- | --- |
| Ticker / scheme code | Symbol, Trading Symbol, Ticker, Scrip, Scrip Name, Security, Stock, Scheme Code, Fund Code, Yahoo Code |
| Quantity / units | Qty, Quantity, Shares, Units, Allotted Units, Quantity Available, Balance Units |
| Buy price / NAV | Avg Price, Average Price, Avg Buy Price, Avg Cost Price, Weighted Average Price, Buy Price, Cost, Rate, NAV, Purchase NAV |
| Broker | Broker, Account, Demat, Platform, Folio Number |
| Exchange | Exchange, Market |
| Company / scheme | Company, Company Name, Security Name, Name, Scheme Name, Fund Name |

Users preview the source, change any mapping, inspect row errors and possible duplicates, sort the preview by investment, quantity, cost, statement CMP, or validation status, and explicitly confirm valid rows before insertion. Required values are ticker/scheme identifier, positive quantity, and positive average cost/NAV. CMP, LTP, closing price, and current market price are displayed separately and are never substituted for purchase cost. When a statement provides total invested value but no average cost, average cost is derived as invested value divided by quantity. Common Indian equity symbols are normalized to `.NS` format when the source has no exchange suffix. Broker-only ETF suffixes are removed (`SILVERBEES-E` becomes `SILVERBEES.NS`), and SGB symbols such as `SGBFEB32IV-GB` become `SGBFEB32IV`.

Broker balance statements are imported without an acquisition date. The app does not substitute the statement valuation date or invent a purchase date. When selling or redeeming, the user must explicitly choose whether the sale is Short-Term or Long-Term.

Mutual-fund statements frequently provide an ISIN and scheme name. The importer stores the ISIN as the stable scheme identifier, preserves the full scheme name, and matches the latest official AMFI end-of-day NAV by ISIN. Yahoo-format fund symbols remain supported as a fallback.

### PDF statements

PDF parsing first uses positioned lines and table geometry. If the PDF has no detectable table, the server falls back to conservative text-column extraction. PDFs vary widely, so every result remains marked uncertain, exposes the detected rows and mappings, and requires a separate confirmation checkbox after comparison with the original statement. Invalid rows are never silently inserted; importing only valid rows requires an explicit “skip invalid rows” confirmation. Scanned-image PDFs still need OCR before upload.

### Manual entry

Manual entry supports stocks/ETFs, mutual funds, SGBs, and physical gold. It includes common broker/custody suggestions while still accepting a custom value. Equity autocomplete remains server-backed.

## Market-data endpoints

- `GET /api/market/quotes?tickers=...` — deduplicated batched quotes with a 60-second in-memory cache
- `GET /api/market/search?q=...` — ticker autocomplete
- `GET /api/market/nav?schemes=...` — latest normalized AMFI NAV and active/stale status matched by scheme code or ISIN
- `POST /api/portfolio/sync-corporate-actions` — confirmed split synchronization; requires `Authorization: Bearer $CRON_SECRET`
- `GET /api/cron/eod-report` — webhook-ready per-user EOD reports; requires the same bearer secret

All market requests run in server code, use timeouts and short caches, and degrade gracefully. When no usable price exists, the holding remains in portfolio value at adjusted acquisition cost and is explicitly labeled cost-valued; its unrealized return remains unavailable rather than being fabricated. User-facing read endpoints require a valid Supabase session.

Corporate-action provider payloads are not stored; only the small permanent action identity/ratio/date audit row remains so a split can never be applied twice. That safety ledger must not be deleted by a retention job.

## Vercel deployment and cron

1. Push the repository to GitHub and import it into Vercel.
2. Add the environment variables in Project Settings → Environment Variables. Keep the service role and cron secret restricted to server environments.
3. Add the Vercel production URL and `/auth/callback` URL in Supabase Auth.
4. Deploy. Vercel runs `npm run build` automatically.
5. [`vercel.json`](./vercel.json) schedules `/api/cron/eod-report` at `10:30 UTC` on weekdays (16:00 IST). Vercel sends `Authorization: Bearer <CRON_SECRET>` to cron requests when `CRON_SECRET` is configured.

To test locally:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/eod-report
curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/portfolio/sync-corporate-actions
```

## Known market-data limitations

- `yahoo-finance2` is an unofficial Yahoo Finance client. Quotes can be delayed, missing, rate-limited, or unavailable for delisted/unsupported instruments.
- NSE publishes official real-time feeds as licensed data products rather than a stable anonymous developer API. The app therefore does not scrape NSE's website endpoint from Vercel; Yahoo remains the best-effort equity adapter until a licensed NSE/vendor feed is configured.
- Exchange suffixes matter (`.NS` and `.BO` for many Indian listings). The stored exchange label does not automatically rewrite a ticker.
- Indian mutual-fund NAV is matched from AMFI's latest text report by scheme code or ISIN. NAV is end-of-day rather than intraday, may be delayed around weekends/holidays, and is marked stale when appropriate.
- SGB quotes use BSE's public active-debt listing and quote web endpoints. Those endpoints are not a contracted API and may change or reject requests; unavailable SGBs remain visible at adjusted cost.
- Physical-gold value is an approximate reference derived from a public XAU/USD feed, USD/INR, and purity. It is not a jeweller buyback quote and excludes GST, making charges, spreads, and local premiums.
- The quote cache is per server instance; serverless instances do not share memory.
- Sector metadata is not present in all quote payloads, so those positions appear as Unclassified.
- Only provider-confirmed split events are applied automatically. Bonus issues, rights issues, mergers, demergers, and ambiguous equivalents need review.

## Security and reliability notes

- Every Server Action authenticates again, validates with Zod, and verifies that client-supplied member IDs belong to the current user.
- Market-data/database secrets never enter Client Components.
- Sales and corporate actions are database transactions, not multi-request browser workflows.
- RLS is the final tenant boundary even if application filtering is bypassed.
- Import parsers enforce file/type/row limits. Because the required open-source `xlsx` package has longstanding upstream advisories, keep the size limit, parse only trusted broker exports, and update the dependency when a patched npm release becomes available.
