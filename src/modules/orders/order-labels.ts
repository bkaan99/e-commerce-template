import type { OrderStatus } from "./order.types";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Ödeme bekleniyor",
  PAID: "Ödeme alındı",
  PROCESSING: "Hazırlanıyor",
  SHIPPED: "Kargoya verildi",
  DELIVERED: "Teslim edildi",
  CANCELLED: "İptal edildi",
  REFUNDED: "İade edildi",
};

const CANCELLABLE: readonly OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
];

export function isCancellable(status: OrderStatus): boolean {
  return CANCELLABLE.includes(status);
}
