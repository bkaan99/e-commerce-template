import type { OrderStatus, PaymentStatus } from "./order.types";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Ödeme bekleniyor",
  PAID: "Ödeme alındı",
  PROCESSING: "Hazırlanıyor",
  SHIPPED: "Kargoya verildi",
  DELIVERED: "Teslim edildi",
  CANCELLED: "İptal edildi",
  REFUNDED: "İade edildi",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Bekliyor",
  PAID: "Ödendi",
  FAILED: "Başarısız",
  REFUNDED: "İade edildi",
  PARTIALLY_REFUNDED: "Kısmen iade edildi",
};

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

export const ORDER_STATUS_TONES: Record<OrderStatus, StatusTone> = {
  PENDING_PAYMENT: "warning",
  PAID: "info",
  PROCESSING: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
  REFUNDED: "neutral",
};

const CANCELLABLE: readonly OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
];

export function isCancellable(status: OrderStatus): boolean {
  return CANCELLABLE.includes(status);
}
