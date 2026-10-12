import { TURKEY_DISTRICTS, isDistrictOf } from "@/shared/geo/turkey-districts";
import { z } from "zod";

/** Türkiye cep telefonunu 05XXXXXXXXX biçimine getirir; geçersizse null. */
export function normalizeTurkishMobile(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let local = digits;

  if (local.startsWith("90") && local.length === 12) local = local.slice(2);
  if (local.length === 10 && local.startsWith("5")) local = `0${local}`;

  return /^05\d{9}$/.test(local) ? local : null;
}

/** T.C. kimlik numarası doğrulama algoritması. */
export function isValidTckn(value: string): boolean {
  if (!/^[1-9]\d{10}$/.test(value)) return false;

  const digits = value.split("").map(Number);
  const oddSum = digits[0]! + digits[2]! + digits[4]! + digits[6]! + digits[8]!;
  const evenSum = digits[1]! + digits[3]! + digits[5]! + digits[7]!;
  const tenth = (((oddSum * 7 - evenSum) % 10) + 10) % 10;
  const eleventh = digits.slice(0, 10).reduce((sum, d) => sum + d, 0) % 10;

  return digits[9] === tenth && digits[10] === eleventh;
}

const trimmed = (min: number, max: number, message: string) =>
  z.string().trim().min(min, message).max(max);

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

export const addressSchema = z
  .object({
    firstName: trimmed(2, 60, "Ad en az 2 karakter olmalı"),
    lastName: trimmed(2, 60, "Soyad en az 2 karakter olmalı"),
    phone: z.string().transform((value, ctx) => {
      const normalized = normalizeTurkishMobile(value);
      if (!normalized) {
        ctx.addIssue({
          code: "custom",
          message: "Geçerli bir cep telefonu girin",
        });
        return z.NEVER;
      }
      return normalized;
    }),
    city: trimmed(2, 60, "İl seçin"),
    district: trimmed(2, 60, "İlçe seçin"),
    neighborhood: optionalTrimmed(120),
    addressLine: trimmed(10, 300, "Adres en az 10 karakter olmalı"),
    postalCode: optionalTrimmed(10),
    invoiceType: z.enum(["INDIVIDUAL", "CORPORATE"]).default("INDIVIDUAL"),
    nationalId: optionalTrimmed(11),
    companyName: optionalTrimmed(150),
    taxNumber: optionalTrimmed(11),
    taxOffice: optionalTrimmed(100),
  })
  .superRefine((address, ctx) => {
    // İl bilinen bir ilse ilçe o ile ait olmalı (yanlış il/ilçe eşleşmesini önler).
    if (
      address.city in TURKEY_DISTRICTS &&
      !isDistrictOf(address.city, address.district)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["district"],
        message: "Seçilen ile ait bir ilçe seçin",
      });
    }

    if (address.invoiceType === "INDIVIDUAL") {
      if (address.nationalId && !isValidTckn(address.nationalId)) {
        ctx.addIssue({
          code: "custom",
          path: ["nationalId"],
          message: "Geçersiz T.C. kimlik numarası",
        });
      }
      return;
    }

    if (!address.companyName) {
      ctx.addIssue({
        code: "custom",
        path: ["companyName"],
        message: "Firma unvanı zorunlu",
      });
    }
    if (!address.taxNumber || !/^\d{10}$/.test(address.taxNumber)) {
      ctx.addIssue({
        code: "custom",
        path: ["taxNumber"],
        message: "Vergi numarası 10 haneli olmalı",
      });
    }
    if (!address.taxOffice) {
      ctx.addIssue({
        code: "custom",
        path: ["taxOffice"],
        message: "Vergi dairesi zorunlu",
      });
    }
  });

export type AddressInput = z.infer<typeof addressSchema>;

export const checkoutSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Geçerli bir e-posta girin")),
  shippingAddress: addressSchema,
  /** Boşsa teslimat adresi fatura adresi olarak kullanılır. */
  billingAddress: addressSchema.optional(),
  couponCode: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((value) => (value ? value.toUpperCase() : null)),
  customerNote: optionalTrimmed(500),
  paymentMethod: z.enum(["CARD", "BANK_TRANSFER", "DEFERRED"]).default("CARD"),
  acceptTerms: z.literal(true, { error: "Sözleşmeleri onaylamalısınız" }),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
