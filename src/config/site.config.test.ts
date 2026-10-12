import { describe, expect, it } from "vitest";
import type { Features } from "./features";
import { siteConfig, validateSiteConfig } from "./site.config";

/** Testler projeye özel yapılandırmadan (project.json) bağımsız çalışır. */
const baseConfig = { ...siteConfig, salesMode: "retail" as const };

const allOff: Features = {
  b2b: false,
  guestCheckout: true,
  wishlist: true,
  blog: false,
  sms: false,
  captcha: false,
  erp: false,
};

describe("validateSiteConfig", () => {
  it("mevcut proje yapılandırması geçerlidir", () => {
    expect(() => validateSiteConfig()).not.toThrow();
  });

  it("b2b bayrağı kapalıyken salesMode b2b olamaz", () => {
    expect(() =>
      validateSiteConfig({ ...baseConfig, salesMode: "b2b" }, allOff),
    ).toThrow(/features\.b2b/);
  });

  it("b2b bayrağı açıkken hybrid kabul edilir", () => {
    expect(() =>
      validateSiteConfig(
        { ...baseConfig, salesMode: "hybrid" },
        { ...allOff, b2b: true },
      ),
    ).not.toThrow();
  });

  it("cayma süresi 14 günden kısa olamaz", () => {
    expect(() =>
      validateSiteConfig(
        { ...baseConfig, returns: { withdrawalPeriodDays: 7 } },
        allOff,
      ),
    ).toThrow(/14/);
  });
});
