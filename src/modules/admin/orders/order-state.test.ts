import { describe, expect, it } from "vitest";
import {
  allowedTransitions,
  canTransition,
  isStaffCancellable,
} from "./order-state";

describe("sipariş durum makinesi", () => {
  it("ödenmiş sipariş hazırlanıyor veya kargolandı olabilir", () => {
    expect(allowedTransitions("PAID")).toEqual(["PROCESSING", "SHIPPED"]);
  });

  it("kargolanmamış sipariş teslim edildi olamaz", () => {
    expect(canTransition("PAID", "DELIVERED")).toBe(false);
    expect(canTransition("PROCESSING", "DELIVERED")).toBe(false);
  });

  it("kargolanan sipariş yalnızca teslim edildi olabilir", () => {
    expect(allowedTransitions("SHIPPED")).toEqual(["DELIVERED"]);
  });

  it("son durumlardan geçiş yoktur", () => {
    for (const status of ["DELIVERED", "CANCELLED", "REFUNDED"] as const) {
      expect(allowedTransitions(status)).toEqual([]);
    }
  });

  it("yalnızca kargolanmamış siparişler iptal edilebilir", () => {
    expect(isStaffCancellable("PAID")).toBe(true);
    expect(isStaffCancellable("SHIPPED")).toBe(false);
    expect(isStaffCancellable("DELIVERED")).toBe(false);
  });
});
