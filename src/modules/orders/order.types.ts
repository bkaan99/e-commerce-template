import type {
  InvoiceType,
  OrderStatus,
  PaymentStatus,
} from "../../../generated/prisma/client";

export type { InvoiceType, OrderStatus, PaymentStatus };

export type PaymentMethod = "CARD" | "BANK_TRANSFER" | "DEFERRED";

/** Sipariş anındaki adres kopyası; adres defteri değişse de sipariş değişmez. */
export interface AddressSnapshot {
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  district: string;
  neighborhood: string | null;
  addressLine: string;
  postalCode: string | null;
  invoiceType: InvoiceType;
  nationalId: string | null;
  companyName: string | null;
  taxNumber: string | null;
  taxOffice: string | null;
}

export interface OrderItemView {
  /** Katalogdaki varyant (silinmişse null) */
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

export interface OrderView {
  id: string;
  orderNumber: string;
  lookupToken: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  email: string;
  currency: string;
  subtotal: string;
  discountTotal: string;
  shippingTotal: string;
  taxTotal: string;
  grandTotal: string;
  couponCode: string | null;
  shippingAddress: AddressSnapshot;
  billingAddress: AddressSnapshot;
  customerNote: string | null;
  items: OrderItemView[];
  trackingNumber: string | null;
  carrier: string | null;
  createdAt: Date;
  userId: string | null;
  /** Son ödeme kaydının yöntemi */
  paymentMethod: PaymentMethod;
  /** Vadeli ödemede vade tarihi */
  paymentDueAt: Date | null;
}

export interface NewOrderItem {
  variantId: string;
  productName: string;
  variantName: string | null;
  sku: string;
  unitPrice: string;
  taxRate: string;
  quantity: number;
  lineTotal: string;
  /** Stok takibi yapılmayan üründe rezervasyon atlanır */
  trackInventory: boolean;
}

export interface NewOrder {
  userId: string | null;
  email: string;
  cartId: string | null;
  currency: string;
  subtotal: string;
  discountTotal: string;
  shippingTotal: string;
  taxTotal: string;
  grandTotal: string;
  couponCode: string | null;
  shippingAddress: AddressSnapshot;
  billingAddress: AddressSnapshot;
  customerNote: string | null;
  items: NewOrderItem[];
  reservationMinutes: number;
  paymentProvider: string;
  paymentMethod: PaymentMethod;
}

export interface CreatedOrder {
  orderId: string;
  orderNumber: string;
  lookupToken: string;
  merchantOid: string;
}

export type PaymentOutcome =
  | { kind: "paid"; orderId: string }
  | { kind: "failed"; orderId: string }
  | { kind: "already-processed"; orderId: string }
  | { kind: "amount-mismatch"; orderId: string }
  | { kind: "not-found" };
