import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, PERMISSIONS, SYSTEM_ROLES } from "./permissions";

describe("system roles", () => {
  it("dört hazır rol tanımlıdır", () => {
    expect(SYSTEM_ROLES.map((role) => role.name)).toEqual([
      "admin",
      "editor",
      "warehouse",
      "accounting",
    ]);
  });

  it("admin tüm yetkilere sahiptir", () => {
    const admin = SYSTEM_ROLES.find((role) => role.name === "admin");
    expect(admin?.permissions).toEqual(ALL_PERMISSIONS);
  });

  it("yetki anahtarları benzersizdir", () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
  });

  it("muhasebe iade yapabilir ama ürün düzenleyemez", () => {
    const accounting = SYSTEM_ROLES.find((r) => r.name === "accounting");
    expect(accounting?.permissions).toContain(PERMISSIONS.ORDER_REFUND);
    expect(accounting?.permissions).not.toContain(PERMISSIONS.PRODUCT_WRITE);
  });
});
