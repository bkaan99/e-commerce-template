import { z } from "zod";

const money = z
  .string()
  .trim()
  .regex(/^\d+([.,]\d{1,2})?$/, "Geçerli bir tutar girin")
  .transform((value) => value.replace(",", "."));

const optionalMoney = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))
  .pipe(
    z
      .string()
      .regex(/^\d+([.,]\d{1,2})?$/, "Geçerli bir tutar girin")
      .transform((value) => value.replace(",", "."))
      .nullable(),
  );

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

const optionalNumber = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === "") return null;
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
  })
  .refine(
    (value) => value === null || !Number.isNaN(value),
    "Geçerli bir sayı girin",
  );

export const productOptionSchema = z.object({
  name: z.string().trim().min(1, "Seçenek adı boş olamaz").max(40),
  values: z
    .array(z.string().trim().min(1).max(40))
    .min(1, "En az bir değer girin")
    .max(30),
});

export const productVariantSchema = z.object({
  id: z.string().optional(),
  sku: z.string().trim().min(1, "SKU zorunlu").max(60),
  barcode: optionalText(60),
  price: money,
  compareAtPrice: optionalMoney,
  stockQuantity: z.coerce
    .number()
    .int("Tam sayı girin")
    .min(0, "Stok negatif olamaz"),
  isActive: z.boolean().default(true),
  /** Seçenek adı → değer */
  optionValues: z.record(z.string(), z.string()).default({}),
});

export const productImageSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1)
    .refine(
      (value) => value.startsWith("/") || /^https?:\/\//.test(value),
      "Görsel adresi http(s) veya / ile başlamalı",
    ),
  alt: optionalText(200),
  /** Görsel belirli bir seçenek değerine özelse: { option, value } */
  forOption: z
    .object({ option: z.string(), value: z.string() })
    .nullable()
    .optional()
    .transform((value) => value ?? null),
});

export const productInputSchema = z
  .object({
    name: z.string().trim().min(2, "Ürün adı en az 2 karakter olmalı").max(160),
    slug: z.string().trim().max(80).optional(),
    description: optionalText(5000),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
    categoryId: z.string().min(1, "Kategori seçin"),
    brandId: z
      .string()
      .optional()
      .transform((value) => (value ? value : null)),
    taxRate: z.coerce.number().min(0).max(100),
    trackInventory: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
    desi: optionalNumber,
    weightGram: optionalNumber,
    seoTitle: optionalText(70),
    seoDescription: optionalText(160),
    attributeValueIds: z.array(z.string()).default([]),
    options: z.array(productOptionSchema).max(3, "En fazla 3 seçenek ekseni"),
    variants: z.array(productVariantSchema).min(1, "En az bir varyant gerekli"),
    images: z.array(productImageSchema).max(20).default([]),
  })
  .superRefine((product, ctx) => {
    const skus = new Set<string>();
    for (const [index, variant] of product.variants.entries()) {
      const key = variant.sku.toUpperCase();
      if (skus.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", index, "sku"],
          message: "SKU tekrar ediyor",
        });
      }
      skus.add(key);

      for (const option of product.options) {
        const chosen = variant.optionValues[option.name];
        if (!chosen || !option.values.includes(chosen)) {
          ctx.addIssue({
            code: "custom",
            path: ["variants", index, "optionValues", option.name],
            message: `${option.name} seçilmeli`,
          });
        }
      }
    }

    // Aynı seçenek kombinasyonu iki varyantta bulunamaz.
    const combos = new Set<string>();
    for (const [index, variant] of product.variants.entries()) {
      const key = product.options
        .map((o) => variant.optionValues[o.name])
        .join("|");
      if (combos.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", index],
          message: "Bu seçenek kombinasyonu zaten var",
        });
      }
      combos.add(key);
    }

    const names = product.options.map((o) => o.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Seçenek adları benzersiz olmalı",
      });
    }
  });

export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductVariantInput = z.infer<typeof productVariantSchema>;

/** Seçenek değerlerinin kartezyen çarpımı (varyant üretimi için). */
export function generateCombinations(
  options: readonly { name: string; values: readonly string[] }[],
): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>(
    (combos, option) =>
      combos.flatMap((combo) =>
        option.values.map((value) => ({ ...combo, [option.name]: value })),
      ),
    [{}],
  );
}
