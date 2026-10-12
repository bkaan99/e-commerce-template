import { z } from "zod";

export const groupInputSchema = z.object({
  name: z.string().trim().min(2, "Grup adı en az 2 karakter olmalı").max(60),
  discountPercent: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === "" || value === null) return null;
      const parsed = Number(String(value).replace(",", "."));
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        ctx.addIssue({
          code: "custom",
          message: "İskonto 0 ile 100 arasında olmalı",
        });
        return z.NEVER;
      }
      return parsed;
    }),
});

const price = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const parsed = Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    ctx.addIssue({ code: "custom", message: "Fiyat 0'dan büyük olmalı" });
    return z.NEVER;
  }
  return Math.round(parsed * 100) / 100;
});

export const tierListSchema = z
  .array(
    z.object({
      minQuantity: z.coerce
        .number()
        .int("Adet tam sayı olmalı")
        .min(2, "Kademe adedi en az 2 olmalı"),
      price,
    }),
  )
  .max(10, "En fazla 10 kademe")
  .superRefine((tiers, ctx) => {
    const quantities = tiers.map((tier) => tier.minQuantity);
    if (new Set(quantities).size !== quantities.length) {
      ctx.addIssue({
        code: "custom",
        message: "Aynı adet için iki kademe olamaz",
      });
    }
  });

export const groupPriceSchema = price.nullable();

/** "10:90, 50:75" veya satır satır "adet:fiyat" metnini kademe listesine çevirir. */
export function parseTierText(
  text: string,
): { minQuantity: number; price: string }[] {
  return text
    .split(/[\n,;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [quantity, priceText] = part.split(":").map((item) => item.trim());
      return { minQuantity: Number(quantity), price: priceText ?? "" };
    });
}

export function formatTierText(
  tiers: { minQuantity: number; price: string }[],
): string {
  return [...tiers]
    .sort((a, b) => a.minQuantity - b.minQuantity)
    .map((tier) => `${tier.minQuantity}:${Number(tier.price)}`)
    .join(", ");
}
