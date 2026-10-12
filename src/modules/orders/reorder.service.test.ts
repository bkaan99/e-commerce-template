import { describe, expect, it } from "vitest";
import { ConflictError, NotFoundError } from "@/shared/errors";
import type { CartIdentity, CartMutationResult } from "../cart/cart.types";
import type { OrderView } from "./order.types";
import { ReorderService } from "./reorder.service";

const order = {
  items: [
    { variantId: "v1", productName: "Tişört", quantity: 2 },
    { variantId: "v2", productName: "Pantolon", quantity: 1 },
    { variantId: null, productName: "Kaldırılmış", quantity: 1 },
    { variantId: "v4", productName: "Stoksuz", quantity: 3 },
  ],
} as unknown as OrderView;

const cartResult = (sessionToken?: string): CartMutationResult => ({
  cart: {
    id: "c1",
    lines: [],
    itemCount: 0,
    subtotal: "0",
    currency: "TRY",
    hasIssues: false,
  },
  sessionToken,
});

describe("ReorderService", () => {
  it("uygun ürünleri ekler, uygunsuzları nedenleriyle atlar", async () => {
    const calls: {
      token: string | null;
      variantId: string;
      quantity: number;
    }[] = [];
    const service = new ReorderService(
      { getForAccess: async () => order },
      {
        addItem: async (
          identity: CartIdentity,
          variantId: string,
          quantity: number,
        ) => {
          calls.push({ token: identity.sessionToken, variantId, quantity });
          if (variantId === "v2") throw new NotFoundError("Ürün");
          if (variantId === "v4")
            throw new ConflictError("Stokta yalnızca 1 adet var");
          return cartResult(calls.length === 1 ? "yeni-token" : undefined);
        },
      },
    );

    const result = await service.reorder(
      "SABC",
      { userId: null, lookupToken: "t" },
      { userId: null, sessionToken: null },
    );

    expect(result.added).toBe(1);
    expect(result.sessionToken).toBe("yeni-token");
    expect(result.skipped.map((s) => s.productName)).toEqual([
      "Pantolon",
      "Kaldırılmış",
      "Stoksuz",
    ]);
    expect(result.skipped[2]!.reason).toBe("Stokta yalnızca 1 adet var");
    // Sonraki eklemeler ilk eklemede oluşan sepeti kullanır.
    expect(calls[1]!.token).toBe("yeni-token");
  });

  it("beklenmeyen hataları yutmaz", async () => {
    const service = new ReorderService(
      { getForAccess: async () => order },
      {
        addItem: async () => {
          throw new Error("veritabanı hatası");
        },
      },
    );

    await expect(
      service.reorder(
        "SABC",
        { userId: "u1" },
        { userId: "u1", sessionToken: null },
      ),
    ).rejects.toThrow("veritabanı hatası");
  });
});
