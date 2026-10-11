import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "Geçerli bir tarih girin" });
      return z.NEVER;
    }
    return date;
  });

const safeUrl = (message: string) =>
  z
    .string()
    .trim()
    .refine((value) => /^(https?:\/\/|\/(?!\/))/.test(value), message);

export const bannerInputSchema = z
  .object({
    title: z.string().trim().min(1, "Başlık zorunlu").max(120),
    imageUrl: safeUrl("Görsel adresi http(s) veya / ile başlamalı"),
    linkUrl: optionalText(500).refine(
      (value) => value === null || /^(https?:\/\/|\/(?!\/))/.test(value),
      "Bağlantı http(s) veya / ile başlamalı",
    ),
    sortOrder: z.coerce.number().int().min(0).max(999).default(0),
    startsAt: optionalDate,
    endsAt: optionalDate,
    isActive: z.boolean().default(true),
  })
  .refine(
    (banner) =>
      !banner.startsAt || !banner.endsAt || banner.endsAt > banner.startsAt,
    { path: ["endsAt"], message: "Bitiş tarihi başlangıçtan sonra olmalı" },
  );
export type BannerInput = z.infer<typeof bannerInputSchema>;

export const pageInputSchema = z.object({
  title: z.string().trim().min(2, "Başlık en az 2 karakter olmalı").max(120),
  slug: z.string().trim().max(80).optional(),
  content: z.string().max(50_000),
  isPublished: z.boolean().default(false),
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
});
export type PageInput = z.infer<typeof pageInputSchema>;

export const MENU_KEYS = ["header", "footer"] as const;
export type MenuKey = (typeof MENU_KEYS)[number];

export const menuItemSchema = z.object({
  label: z.string().trim().min(1, "Etiket zorunlu").max(60),
  url: safeUrl("Adres http(s) veya / ile başlamalı"),
});

export const menuInputSchema = z.object({
  key: z.enum(MENU_KEYS),
  items: z.array(menuItemSchema).max(20, "En fazla 20 öğe"),
});
export type MenuInput = z.infer<typeof menuInputSchema>;
