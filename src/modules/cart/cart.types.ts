export const MAX_LINE_QUANTITY = 99;

/** Sepetin sahibi: üye ya da çerezdeki oturum belirteci. */
export interface CartIdentity {
  userId: string | null;
  sessionToken: string | null;
  /** Onaylı bayiyse grubu; fiyatlar bu gruba göre çözülür. */
  customerGroupId?: string | null;
}

export type CartLineIssue = "OUT_OF_STOCK" | "QUANTITY_REDUCED" | "UNAVAILABLE";

export interface CartLine {
  variantId: string;
  productName: string;
  productSlug: string;
  variantLabel: string | null;
  sku: string;
  imageUrl: string | null;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  /** Stok takibi yoksa null */
  availableQuantity: number | null;
  issue: CartLineIssue | null;
}

export interface CartView {
  id: string | null;
  lines: CartLine[];
  itemCount: number;
  subtotal: string;
  currency: string;
  /** Satın alınamayan satır var mı? */
  hasIssues: boolean;
}

export interface CartMutationResult {
  cart: CartView;
  /** Yeni oluşturulan misafir sepet belirteci; çağıran çereze yazar. */
  sessionToken?: string;
  /** Üye girişi sonrası misafir sepeti birleştirildiyse çerez silinmelidir. */
  clearSessionToken?: boolean;
}
