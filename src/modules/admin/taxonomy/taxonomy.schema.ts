import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

export const categoryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Kategori adı en az 2 karakter olmalı")
    .max(80),
  slug: z.string().trim().max(80).optional(),
  parentId: z
    .string()
    .optional()
    .transform((value) => (value ? value : null)),
  description: optionalText(1000),
  imageUrl: optionalText(500),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const brandInputSchema = z.object({
  name: z.string().trim().min(2, "Marka adı en az 2 karakter olmalı").max(80),
  logoUrl: optionalText(500),
});
export type BrandInput = z.infer<typeof brandInputSchema>;

export const attributeInputSchema = z.object({
  name: z.string().trim().min(2, "Nitelik adı en az 2 karakter olmalı").max(60),
  type: z.enum(["SELECT", "MULTI_SELECT"]).default("SELECT"),
  isFilterable: z.boolean().default(true),
  position: z.coerce.number().int().min(0).max(999).default(0),
});
export type AttributeInput = z.infer<typeof attributeInputSchema>;

export const attributeValueSchema = z.object({
  value: z.string().trim().min(1, "Değer boş olamaz").max(60),
});
