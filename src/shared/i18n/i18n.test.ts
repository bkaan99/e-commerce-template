import { describe, expect, it } from "vitest";
import { translate } from "./index";

describe("translate", () => {
  it("anahtarı Türkçe metne çevirir", () => {
    expect(translate("cart.title")).toBe("Sepetim");
  });

  it("yer tutucuları doldurur", () => {
    expect(translate("cart.itemCount", { count: 3 })).toBe("3 ürün");
  });

  it("verilmeyen yer tutucuyu olduğu gibi bırakır", () => {
    expect(translate("cart.itemCount", {})).toBe("{count} ürün");
  });
});
