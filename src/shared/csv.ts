/**
 * CSV üretimi. Excel'de formül olarak çalışabilecek hücreler (=, +, -, @ ile
 * başlayanlar) başına ' eklenerek zararsız hale getirilir (CSV injection).
 */
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = value instanceof Date ? value.toISOString() : String(value);

  if (
    typeof value === "string" &&
    FORMULA_PREFIXES.some((prefix) => text.startsWith(prefix))
  ) {
    text = `'${text}`;
  }

  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  const lines = [headers, ...rows].map((row) =>
    row.map(escapeCsvCell).join(";"),
  );
  // UTF-8 BOM: Excel'in Türkçe karakterleri doğru açması için.
  return `﻿${lines.join("\r\n")}\r\n`;
}
