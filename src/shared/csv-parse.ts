/**
 * CSV okuma (RFC 4180): tırnaklı alanlar, çift tırnak kaçışı, satır içi
 * satır sonu, UTF-8 BOM ve ayraç tespiti (Excel TR ";" kullanır).
 */
export type CsvDelimiter = "," | ";" | "\t";

function detectDelimiter(headerLine: string): CsvDelimiter {
  const candidates: CsvDelimiter[] = [";", ",", "\t"];
  let best: CsvDelimiter = ";";
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = headerLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    // Tamamen boş satırlar atlanır.
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"' && cell === "") inQuotes = true;
    else if (char === delimiter) endCell();
    else if (char === "\n") endRow();
    else if (char === "\r") {
      if (text[i + 1] === "\n") i++;
      endRow();
    } else cell += char;
  }

  if (cell !== "" || row.length > 0) endRow();
  return rows;
}

/** Başlık satırını anahtar olarak kullanıp nesne satırları üretir. */
export function parseCsvRecords(
  input: string,
  normalizeHeader: (header: string) => string = (h) => h.trim(),
): { headers: string[]; records: Record<string, string>[] } {
  const [headerRow, ...dataRows] = parseCsv(input);
  const headers = (headerRow ?? []).map(normalizeHeader);

  const records = dataRows.map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) record[header] = (cells[index] ?? "").trim();
    });
    return record;
  });

  return { headers, records };
}
