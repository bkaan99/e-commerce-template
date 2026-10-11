import { describe, expect, it } from "vitest";
import { availableQuantity, isInStock } from "./availability";

describe("availability", () => {
  it("stok takibi yoksa sınırsızdır", () => {
    const state = {
      trackInventory: false,
      stockQuantity: 0,
      reservedQuantity: 0,
    };
    expect(availableQuantity(state)).toBeNull();
    expect(isInStock(state)).toBe(true);
  });

  it("rezerve edilen adet satılabilir stoktan düşer", () => {
    const state = {
      trackInventory: true,
      stockQuantity: 10,
      reservedQuantity: 4,
    };
    expect(availableQuantity(state)).toBe(6);
  });

  it("rezervasyon stoğu aşsa bile negatif olmaz", () => {
    const state = {
      trackInventory: true,
      stockQuantity: 2,
      reservedQuantity: 5,
    };
    expect(availableQuantity(state)).toBe(0);
    expect(isInStock(state)).toBe(false);
  });
});
