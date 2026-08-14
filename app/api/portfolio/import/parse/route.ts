import { NextResponse } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { PDFParse } from "pdf-parse";
import { requireUser } from "@/lib/supabase/auth";
import { parseTabularSheets, type TabularSheet } from "@/lib/import/portfolio-parser";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 8 * 1024 * 1024;

function pdfTextRows(value: string) {
  const headerPhrases = [
    "Quantity Available",
    "Available Quantity",
    "Average Price",
    "Purchase Date",
    "Trade Date",
    "Buy Date",
    "Scheme Name",
    "Company Name",
    "Instrument Type",
    "Symbol",
    "Ticker",
    "Scrip",
    "ISIN",
    "Quantity",
    "Qty",
    "Units",
    "NAV",
    "Broker",
    "Exchange",
  ];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const headerCells = headerPhrases
        .map((phrase) => ({ phrase, index: line.toLowerCase().indexOf(phrase.toLowerCase()) }))
        .filter((match) => match.index >= 0)
        .sort((left, right) => left.index - right.index)
        .filter((match, index, matches) => !matches.some(
          (other, otherIndex) => otherIndex !== index
            && other.index <= match.index
            && other.index + other.phrase.length >= match.index + match.phrase.length,
        ))
        .map((match) => match.phrase);
      if (headerCells.length >= 3) return headerCells;

      const isinRow = line.match(
        /^(.*?)\s+(IN[A-Z0-9]{10})\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+(\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{4})$/i,
      );
      if (isinRow) return isinRow.slice(1);
      return line.split(/\t+|\s{2,}|\s*,\s*/).filter(Boolean);
    });
}

export async function POST(request: Request) {
  try {
    await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "A file is required." }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "File exceeds the 8 MB limit." }, { status: 413 });
    const extension = file.name.split(".").pop()?.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let sheets: TabularSheet[];
    let uncertain = false;
    let extractedBy: "spreadsheet" | "pdf-table" | "pdf-text" = "spreadsheet";
    const routeWarnings: string[] = [];

    if (extension === "csv") {
      const result = Papa.parse<unknown[]>(buffer.toString("utf8"), {
        skipEmptyLines: "greedy",
        dynamicTyping: false,
      });
      sheets = [{ name: "CSV", rows: result.data }];
      if (result.errors.length) routeWarnings.push(
        ...result.errors.slice(0, 5).map((error) => `CSV row ${error.row ?? "unknown"}: ${error.message}`),
      );
    } else if (extension === "xlsx" || extension === "xls") {
      const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, dense: true });
      sheets = workbook.SheetNames.map((name) => ({
        name,
        rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
          header: 1,
          raw: false,
          dateNF: "yyyy-mm-dd",
          defval: "",
          blankrows: true,
        }),
      }));
    } else if (extension === "pdf") {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        let tables: string[][][] = [];
        try {
          const tableResult = await parser.getTable();
          tables = tableResult.mergedTables.filter((table) => table.length > 1);
        } catch {
          routeWarnings.push("The PDF did not expose a structured table; text extraction was used.");
        }
        if (tables.length) {
          sheets = tables.map((rows, index) => ({ name: `PDF table ${index + 1}`, rows }));
          extractedBy = "pdf-table";
        } else {
          const textResult = await parser.getText();
          sheets = [{ name: "PDF text", rows: pdfTextRows(textResult.text) }];
          extractedBy = "pdf-text";
        }
      } finally {
        await parser.destroy();
      }
      uncertain = true;
    } else {
      return NextResponse.json({ error: "Use a CSV, XLS, XLSX, or PDF file." }, { status: 415 });
    }

    const parsed = parseTabularSheets(sheets);
    return NextResponse.json({
      ...parsed,
      warnings: [...routeWarnings, ...parsed.warnings],
      uncertain,
      extractedBy,
      message: uncertain
        ? "PDF rows were extracted on the server. Review every value and confirm the extraction before importing."
        : `${parsed.rows.length} holdings detected across ${parsed.detectedSheets.length} data sheet${parsed.detectedSheets.length === 1 ? "" : "s"}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to parse file.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
