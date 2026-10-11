export interface StockState {
  trackInventory: boolean;
  stockQuantity: number;
  reservedQuantity: number;
}

/** Satılabilir adet. Stok takibi yoksa null (sınırsız). */
export function availableQuantity(state: StockState): number | null {
  if (!state.trackInventory) return null;
  return Math.max(0, state.stockQuantity - state.reservedQuantity);
}

export function isInStock(state: StockState): boolean {
  const quantity = availableQuantity(state);
  return quantity === null || quantity > 0;
}
