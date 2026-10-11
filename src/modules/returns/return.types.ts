export type ReturnStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "COMPLETED";

export interface ReturnableItem {
  orderItemId: string;
  productName: string;
  variantName: string | null;
  unitPrice: string;
  orderedQuantity: number;
  /** Henüz iade talebine konu olmamış adet */
  requestableQuantity: number;
}

export interface ReturnEligibility {
  eligible: boolean;
  reason: string | null;
  deadline: Date | null;
  items: ReturnableItem[];
}

export interface ReturnRequestInput {
  items: { orderItemId: string; quantity: number }[];
  reason: string;
  note: string | null;
}

export interface ReturnRequestSummary {
  id: string;
  orderNumber: string;
  email: string;
  status: ReturnStatus;
  reason: string;
  note: string | null;
  adminNote: string | null;
  createdAt: Date;
  items: {
    productName: string;
    variantName: string | null;
    quantity: number;
    unitPrice: string;
  }[];
  /** Onaylanırsa iade edilecek tutar */
  refundAmount: string;
}

export const RETURN_REASONS = [
  "Ürün beklentimi karşılamadı",
  "Yanlış ürün gönderildi",
  "Ürün hasarlı veya kusurlu geldi",
  "Beden/ölçü uymadı",
  "Vazgeçtim",
  "Diğer",
] as const;
