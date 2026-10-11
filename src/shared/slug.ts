const TURKISH_MAP: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  i̇: "i",
  ö: "o",
  ş: "s",
  ü: "u",
};

/** Türkçe karakterleri sadeleştirip URL için güvenli bir slug üretir. */
export function slugify(value: string): string {
  const lowered = value.toLocaleLowerCase("tr");
  const mapped = Array.from(lowered)
    .map((char) => TURKISH_MAP[char] ?? char)
    .join("");

  return mapped
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Aynı slug varsa sonuna sayı ekleyerek benzersiz hale getirir. */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || "urun";
  if (!(await exists(root))) return root;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${root}-${suffix}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${root}-${Date.now()}`;
}
