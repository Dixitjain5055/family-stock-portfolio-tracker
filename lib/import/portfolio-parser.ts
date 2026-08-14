export type ImportedAssetType = "stock" | "mutual_fund" | "sgb" | "gold";

export type TabularSheet = {
  name: string;
  rows: unknown[][];
};

export type ParsedImportRow = {
  rowNumber: number;
  sheetName: string;
  detectedAssetType: ImportedAssetType;
  values: Record<string, string>;
};

export type PortfolioParseResult = {
  headers: string[];
  rows: ParsedImportRow[];
  suggestions: Record<string, string>;
  warnings: string[];
  detectedSheets: string[];
  statementDate: string | null;
  requiresFallbackDate: boolean;
  mixedAssetTypes: boolean;
};

const CANONICAL_HEADERS = [
  "Ticker / Scheme Code",
  "Company / Scheme Name",
  "Quantity",
  "Average Price",
  "Buy Date",
  "Broker / Folio",
  "Exchange",
  "ISIN",
  "Source Sheet",
  "Statement CMP",
] as const;

type Field =
  | "ticker"
  | "isin"
  | "quantity"
  | "buyPrice"
  | "buyDate"
  | "broker"
  | "exchange"
  | "companyName"
  | "instrumentType"
  | "currentPrice"
  | "investedValue";

const ALIASES: Record<Field, string[]> = {
  ticker: ["symbol", "ticker", "trading symbol", "scrip", "scrip name", "security", "stock", "scheme code", "fund code", "yahoo code"],
  isin: ["isin", "isin code", "security isin"],
  quantity: [
    "qty",
    "quantity",
    "shares",
    "units",
    "allotted units",
    "quantity available",
    "available quantity",
    "available qty",
    "balance units",
    "closing quantity",
  ],
  buyPrice: [
    "avg price",
    "average price",
    "buy price",
    "cost",
    "cost price",
    "rate",
    "nav",
    "purchase nav",
    "allotment nav",
    "average cost",
    "avg cost",
    "avg buy price",
    "average buy price",
    "average acquisition price",
    "weighted average price",
    "average cost price",
    "avg cost price",
    "purchase price",
    "average rate",
  ],
  buyDate: ["trade date", "buy date", "purchase date", "acquisition date", "allotment date", "date"],
  broker: ["broker", "account", "demat", "platform", "folio", "folio number", "account number"],
  exchange: ["exchange", "market", "segment"],
  companyName: [
    "company",
    "company name",
    "security name",
    "name",
    "scheme",
    "scheme name",
    "fund",
    "fund name",
    "description",
  ],
  instrumentType: ["instrument type", "asset type", "security type", "product type", "category"],
  currentPrice: [
    "cmp",
    "current market price",
    "current price",
    "market price",
    "last traded price",
    "ltp",
    "closing price",
    "previous closing price",
    "prev closing price",
    "close price",
  ],
  investedValue: [
    "invested value",
    "investment value",
    "invested amount",
    "cost value",
    "cost amount",
    "total cost",
    "book value",
    "total investment",
  ],
};

const CANONICAL_SUGGESTIONS = {
  ticker: CANONICAL_HEADERS[0],
  companyName: CANONICAL_HEADERS[1],
  quantity: CANONICAL_HEADERS[2],
  buyPrice: CANONICAL_HEADERS[3],
  buyDate: CANONICAL_HEADERS[4],
  broker: CANONICAL_HEADERS[5],
  exchange: CANONICAL_HEADERS[6],
};

function text(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return String(value ?? "").replace(/\u00a0/g, " ").trim();
}

function normalizedHeader(value: unknown) {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:rs|inr|per share|per unit)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fieldForHeader(value: unknown): Field | null {
  const normalized = normalizedHeader(value);
  for (const [field, aliases] of Object.entries(ALIASES) as Array<[Field, string[]]>) {
    if (aliases.includes(normalized)) return field;
  }
  return null;
}

function findHeaderRow(rows: unknown[][]) {
  let best: { index: number; score: number; fields: Partial<Record<Field, number>> } | null = null;
  const candidates = rows.slice(0, 100);
  for (let index = 0; index < candidates.length; index += 1) {
    const row = candidates[index];
    const fields: Partial<Record<Field, number>> = {};
    row.forEach((cell, cellIndex) => {
      const field = fieldForHeader(cell);
      if (field && fields[field] === undefined) fields[field] = cellIndex;
    });
    const identity = fields.ticker !== undefined || fields.companyName !== undefined || fields.isin !== undefined;
    const score =
      (identity ? 4 : 0) +
      (fields.quantity !== undefined ? 4 : 0) +
      (fields.buyPrice !== undefined ? 4 : 0) +
      (fields.investedValue !== undefined ? 4 : 0) +
      (fields.currentPrice !== undefined ? 2 : 0) +
      (fields.buyDate !== undefined ? 2 : 0) +
      (fields.isin !== undefined ? 1 : 0) +
      (fields.instrumentType !== undefined ? 1 : 0);
    if (!best || score > best.score) best = { index, score, fields };
  }
  return best && best.score >= 10 ? best : null;
}

export function parseImportNumber(value: unknown) {
  const raw = text(value);
  if (!raw) return Number.NaN;
  const negative = /^\(.*\)$/.test(raw);
  const cleaned = raw
    .replace(/[₹$€£,\s]/g, "")
    .replace(/[()]/g, "")
    .replace(/[^0-9.+-]/g, "");
  const result = Number(cleaned);
  return negative ? -result : result;
}

function excelSerialToDate(serial: number) {
  if (!Number.isFinite(serial) || serial < 1 || serial > 100000) return "";
  const date = new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86_400_000));
  return date.toISOString().slice(0, 10);
}

export function normalizeImportDate(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? "" : raw;
  }
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(raw)) {
    const [year, month, day] = raw.split("/").map(Number);
    return normalizeImportDate(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  const dayFirst = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (dayFirst) {
    const year = Number(dayFirst[3]) + (dayFirst[3].length === 2 ? 2000 : 0);
    return normalizeImportDate(
      `${year}-${String(Number(dayFirst[2])).padStart(2, "0")}-${String(Number(dayFirst[1])).padStart(2, "0")}`,
    );
  }
  if (/^\d+(?:\.\d+)?$/.test(raw)) return excelSerialToDate(Number(raw));
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function detectStatementDate(sheets: TabularSheet[]) {
  for (const sheet of sheets) {
    for (const row of sheet.rows.slice(0, 25)) {
      const line = row.map(text).join(" ");
      const iso = line.match(/\b(?:as\s+(?:on|of)\s*)?(\d{4}-\d{2}-\d{2})\b/i);
      if (iso) return normalizeImportDate(iso[1]);
      const dayFirst = line.match(/\b(?:as\s+(?:on|of)\s*)?(\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/i);
      if (dayFirst) return normalizeImportDate(dayFirst[1]);
    }
  }
  return null;
}

function sheetAssetType(sheetName: string): ImportedAssetType | null {
  if (/mutual|fund|mf\b/i.test(sheetName)) return "mutual_fund";
  if (/sovereign gold|\bsgb\b/i.test(sheetName)) return "sgb";
  if (/physical gold|gold holding/i.test(sheetName)) return "gold";
  if (/equity|stock|share/i.test(sheetName)) return "stock";
  return null;
}

function rowAssetType(
  sheetType: ImportedAssetType | null,
  row: unknown[],
  fields: Partial<Record<Field, number>>,
): ImportedAssetType {
  const instrument = fields.instrumentType === undefined ? "" : text(row[fields.instrumentType]);
  const symbol = fields.ticker === undefined ? "" : text(row[fields.ticker]);
  if (/sovereign gold|\bsgb\b|gold bonds?/i.test(`${instrument} ${symbol}`) || /-GB(?:\.NS)?$/i.test(symbol)) return "sgb";
  if (/physical gold|gold jewellery|gold coin|gold bar/i.test(`${instrument} ${symbol}`)) return "gold";
  if (/mutual|fund|scheme|\bmf\b/i.test(instrument)) return "mutual_fund";
  if (sheetType) return sheetType;
  if (/\b(?:fund|direct|regular|growth|dividend)\b/i.test(symbol)) return "mutual_fund";
  return "stock";
}

function plainNseTicker(value: string) {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "").replace(/-E(?=\.NS$|$)/, "");
  if (!normalized || normalized.includes(".") || /^IN[A-Z0-9]{10}$/.test(normalized)) return normalized;
  return /^[A-Z0-9&-]+$/.test(normalized) ? `${normalized}.NS` : normalized;
}

function sgbTicker(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "").replace(/-GB(?:\.NS)?$/, "").replace(/\.NS$/, "");
}

function goldTicker(value: string) {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "");
  if (/^(?:GOLD-?)?(?:24K|999)$/.test(normalized)) return "GOLD-24K";
  if (/^(?:GOLD-?)?(?:22K|916)$/.test(normalized)) return "GOLD-22K";
  if (/^(?:GOLD-?)?(?:18K|750)$/.test(normalized)) return "GOLD-18K";
  return normalized || "GOLD-24K";
}

function valueAt(row: unknown[], fields: Partial<Record<Field, number>>, field: Field) {
  const index = fields[field];
  return index === undefined ? "" : text(row[index]);
}

function chooseSheets(sheets: TabularSheet[]) {
  const hasSpecific = sheets.some((sheet) => /equity|stock|share/i.test(sheet.name))
    && sheets.some((sheet) => /mutual|fund|mf\b/i.test(sheet.name));
  return hasSpecific ? sheets.filter((sheet) => !/^combined|consolidated|summary$/i.test(sheet.name.trim())) : sheets;
}

export function parseTabularSheets(inputSheets: TabularSheet[]): PortfolioParseResult {
  const warnings = new Set<string>();
  const parsedRows: ParsedImportRow[] = [];
  const detectedSheets: string[] = [];
  const selectedSheets = chooseSheets(inputSheets);
  const statementDate = detectStatementDate(inputSheets);

  for (const sheet of selectedSheets) {
    const header = findHeaderRow(sheet.rows);
    if (!header) {
      if (sheet.rows.some((row) => row.some((cell) => text(cell)))) {
        warnings.add(`No supported holdings table was found on “${sheet.name}”.`);
      }
      continue;
    }
    detectedSheets.push(sheet.name);
    const inferredSheetType = sheetAssetType(sheet.name);
    let blankRun = 0;

    for (let index = header.index + 1; index < Math.min(sheet.rows.length, header.index + 2001); index += 1) {
      const row = sheet.rows[index] ?? [];
      if (!row.some((cell) => text(cell))) {
        blankRun += 1;
        if (blankRun >= 10) break;
        continue;
      }
      blankRun = 0;

      const assetType = rowAssetType(inferredSheetType, row, header.fields);
      const symbol = valueAt(row, header.fields, "ticker");
      const isin = valueAt(row, header.fields, "isin").toUpperCase();
      const name = valueAt(row, header.fields, "companyName")
        || (assetType === "mutual_fund" ? symbol : assetType === "sgb" ? sgbTicker(symbol) : assetType === "gold" ? "Physical gold" : "");
      const rawTicker = assetType === "mutual_fund" ? isin || symbol : symbol || isin;
      const quantity = parseImportNumber(valueAt(row, header.fields, "quantity"));
      const directBuyPrice = parseImportNumber(valueAt(row, header.fields, "buyPrice"));
      const investedValue = parseImportNumber(valueAt(row, header.fields, "investedValue"));
      const buyPrice = directBuyPrice > 0
        ? directBuyPrice
        : investedValue > 0 && quantity > 0
          ? investedValue / quantity
          : Number.NaN;
      const currentPrice = parseImportNumber(valueAt(row, header.fields, "currentPrice"));

      if (!rawTicker || !(quantity > 0) || /^(total|grand total)$/i.test(rawTicker.trim())) continue;

      const exchangeFromRow = valueAt(row, header.fields, "exchange").toUpperCase();
      const ticker = assetType === "stock"
        ? plainNseTicker(rawTicker)
        : assetType === "sgb"
          ? sgbTicker(rawTicker)
          : assetType === "gold"
            ? goldTicker(rawTicker)
            : rawTicker.trim().toUpperCase();
      const exchange = exchangeFromRow || (
        assetType === "mutual_fund" ? "MUTUAL_FUND" : assetType === "gold" ? "GOLD" : "NSE"
      );
      const buyDate = normalizeImportDate(valueAt(row, header.fields, "buyDate"));
      parsedRows.push({
        rowNumber: index + 1,
        sheetName: sheet.name,
        detectedAssetType: assetType,
        values: {
          [CANONICAL_HEADERS[0]]: ticker,
          [CANONICAL_HEADERS[1]]: name || symbol || ticker,
          [CANONICAL_HEADERS[2]]: String(quantity),
          [CANONICAL_HEADERS[3]]: buyPrice > 0 ? String(buyPrice) : "",
          [CANONICAL_HEADERS[4]]: buyDate,
          [CANONICAL_HEADERS[5]]: valueAt(row, header.fields, "broker"),
          [CANONICAL_HEADERS[6]]: exchange,
          [CANONICAL_HEADERS[7]]: isin,
          [CANONICAL_HEADERS[8]]: sheet.name,
          [CANONICAL_HEADERS[9]]: currentPrice > 0 ? String(currentPrice) : "",
        },
      });
    }
  }

  const uniqueRows = parsedRows.filter((row, index, rows) => {
    const key = [
      row.detectedAssetType,
      row.values[CANONICAL_HEADERS[0]],
      row.values[CANONICAL_HEADERS[2]],
      row.values[CANONICAL_HEADERS[3]],
      row.values[CANONICAL_HEADERS[4]],
    ].join("|");
    return rows.findIndex((candidate) => [
      candidate.detectedAssetType,
      candidate.values[CANONICAL_HEADERS[0]],
      candidate.values[CANONICAL_HEADERS[2]],
      candidate.values[CANONICAL_HEADERS[3]],
      candidate.values[CANONICAL_HEADERS[4]],
    ].join("|") === key) === index;
  });

  if (uniqueRows.some((row) => row.detectedAssetType === "mutual_fund" && /^IN[A-Z0-9]{10}$/i.test(row.values[CANONICAL_HEADERS[0]]))) {
    warnings.add(
      "Mutual funds are identified by ISIN. Current NAV will be matched against AMFI after import.",
    );
  }
  const rowsWithoutCost = uniqueRows.filter((row) => !(parseImportNumber(row.values[CANONICAL_HEADERS[3]]) > 0)).length;
  if (rowsWithoutCost) {
    warnings.add(`${rowsWithoutCost} row${rowsWithoutCost === 1 ? "" : "s"} ${
      rowsWithoutCost === 1 ? "is" : "are"
    } missing average cost. CMP is shown separately and is never substituted for purchase cost.`);
  }
  if (statementDate) warnings.add(`Statement valuation date detected: ${statementDate}.`);
  if (!uniqueRows.length) warnings.add("No valid holdings rows were detected.");

  return {
    headers: [...CANONICAL_HEADERS],
    rows: uniqueRows,
    suggestions: { ...CANONICAL_SUGGESTIONS },
    warnings: [...warnings],
    detectedSheets,
    statementDate,
    requiresFallbackDate: false,
    mixedAssetTypes: new Set(uniqueRows.map((row) => row.detectedAssetType)).size > 1,
  };
}
