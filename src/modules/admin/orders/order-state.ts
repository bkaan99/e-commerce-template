import type { OrderStatus } from "../../../../generated/prisma/client";

/** Personelin uygulayabildiği sipariş durumu geçişleri. */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: [],
  PAID: ["PROCESSING", "SHIPPED"],
  PROCESSING: ["SHIPPED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};

export function allowedTransitions(
  status: OrderStatus,
): readonly OrderStatus[] {
  return TRANSITIONS[status];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Bu durumdaki bir sipariş personel tarafından iptal edilebilir mi? */
export function isStaffCancellable(status: OrderStatus): boolean {
  return (
    status === "PAID" || status === "PROCESSING" || status === "PENDING_PAYMENT"
  );
}
