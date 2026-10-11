import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@/shared/permissions";
import { visibleNav } from "./navigation";

describe("visibleNav", () => {
  it("yetkisiz kullanıcı yalnızca panoyu görür", () => {
    expect(visibleNav([]).map((item) => item.href)).toEqual(["/admin"]);
  });

  it("depo yetkileri sipariş ve ürün menüsünü açar, denetimi açmaz", () => {
    const hrefs = visibleNav([
      PERMISSIONS.ORDER_READ,
      PERMISSIONS.PRODUCT_READ,
    ]).map((item) => item.href);

    expect(hrefs).toContain("/admin/siparisler");
    expect(hrefs).toContain("/admin/urunler");
    expect(hrefs).not.toContain("/admin/denetim");
  });
});
