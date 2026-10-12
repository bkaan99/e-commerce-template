import { z } from "zod";
import { addressSchema } from "../checkout/checkout.schema";

/** Adres defteri kaydı: teslimat/fatura adresi alanlarına başlık ve varsayılan bayrakları eklenir. */
export const savedAddressSchema = addressSchema.safeExtend({
  title: z.string().trim().min(1, "Adres başlığı zorunlu").max(40),
  isDefaultShipping: z.boolean().default(false),
  isDefaultBilling: z.boolean().default(false),
});

export type SavedAddressInput = z.infer<typeof savedAddressSchema>;

export const MAX_SAVED_ADDRESSES = 10;
