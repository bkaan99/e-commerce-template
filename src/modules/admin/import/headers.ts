/** Başlıkları büyük/küçük harf, Türkçe karakter ve ayraç farkından bağımsız karşılaştırır. */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[\s\-]+/g, "_");
}

export function missingColumns(
  headers: readonly string[],
  required: readonly string[],
): string[] {
  return required.filter((column) => !headers.includes(column));
}
