import { describe, expect, it } from "vitest";
import type { Features } from "./features";
import { siteConfig, validateSiteConfig } from "./site.config";

const allOff: Features = {
  b2b: false,
  guestCheckout: true,
  wishlist: true,
  blog: false,
  sms: false,
  captcha: false,
};

describe("validateSiteConfig", () => {
  it("varsayılan yapılandırma geçerlidir", () => {
    expect(() => validateSiteConfig()).not.toThrow();
  });

  it("b2b bayrağı kapalıyken salesMode b2b olamaz", () => {
    expect(() =>
      validateSiteConfig({ ...siteConfig, salesMode: "b2b" }, allOff),
    ).toThrow(/features\.b2b/);
  });

  it("b2b bayrağı açıkken hybrid kabul edilir", () => {
    expect(() =>
      validateSiteConfig(
        { ...siteConfig, salesMode: "hybrid" },
        { ...allOff, b2b: true },
      ),
    ).not.toThrow();
  });

  it("cayma süresi 14 günden kısa olamaz", () => {
    expect(() =>
      validateSiteConfig(
        { ...siteConfig, returns: { withdrawalPeriodDays: 7 } },
        allOff,
      ),
    ).toThrow(/14/);
  });
});
