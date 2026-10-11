import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@/shared/permissions";
import { hasEveryPermission, hasPermission } from "./authorization";

describe("authorization", () => {
  const granted = [PERMISSIONS.ORDER_READ, PERMISSIONS.ORDER_REFUND];

  it("verilen yetkiyi tanır", () => {
    expect(hasPermission(granted, PERMISSIONS.ORDER_READ)).toBe(true);
    expect(hasPermission(granted, PERMISSIONS.PRODUCT_WRITE)).toBe(false);
  });

  it("hepsi gerekliyse eksik varsa false döner", () => {
    expect(
      hasEveryPermission(granted, [
        PERMISSIONS.ORDER_READ,
        PERMISSIONS.ORDER_REFUND,
      ]),
    ).toBe(true);
    expect(
      hasEveryPermission(granted, [
        PERMISSIONS.ORDER_READ,
        PERMISSIONS.PRODUCT_WRITE,
      ]),
    ).toBe(false);
  });
});
