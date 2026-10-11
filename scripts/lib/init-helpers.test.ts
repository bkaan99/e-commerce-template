import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyEnvValues,
  buildProjectConfig,
  generateSecret,
  isSalesMode,
  isValidEmail,
  isValidHexColor,
  isValidUrl,
  type InitAnswers,
} from "./init-helpers";

const answers: InitAnswers = {
  siteName: "Örnek Mağaza",
  description: "Örnek açıklama",
  appUrl: "https://ornek.com",
  contactEmail: "info@ornek.com",
  contactPhone: "+90 212 000 00 00",
  salesMode: "hybrid",
  guestCheckout: false,
  wishlist: true,
  primaryColor: "#112233",
  accentColor: "#445566",
};

describe("init helpers", () => {
  it("doğrulayıcılar geçerli ve geçersiz değerleri ayırır", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidUrl("https://ornek.com")).toBe(true);
    expect(isValidUrl("ornek.com")).toBe(false);
    expect(isValidHexColor("#a1B2c3")).toBe(true);
    expect(isValidHexColor("a1b2c3")).toBe(false);
    expect(isSalesMode("hybrid")).toBe(true);
    expect(isSalesMode("toptan")).toBe(false);
  });

  it("b2b dışındaki satış modlarında b2b özelliğini açar", () => {
    expect(buildProjectConfig(answers).features?.b2b).toBe(true);
    expect(
      buildProjectConfig({ ...answers, salesMode: "retail" }).features?.b2b,
    ).toBe(false);
  });

  it("yanıtları proje yapılandırmasına çevirir", () => {
    const config = buildProjectConfig(answers);
    expect(config.site?.name).toBe("Örnek Mağaza");
    expect(config.site?.contact?.email).toBe("info@ornek.com");
    expect(config.features?.guestCheckout).toBe(false);
    expect(config.theme?.colors?.primary).toBe("#112233");
  });

  it("üretilen gizli anahtar yeterince uzun ve benzersizdir", () => {
    const a = generateSecret();
    const b = generateSecret();
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(a).not.toBe(b);
  });

  it("applyEnvValues yalnızca verilen anahtarları değiştirir", () => {
    const template = readFileSync(
      path.resolve(import.meta.dirname, "../../.env.example"),
      "utf8",
    );
    const result = applyEnvValues(template, {
      APP_URL: "https://ornek.com",
      AUTH_SECRET: "gizli",
    });

    expect(result).toContain("APP_URL=https://ornek.com");
    expect(result).toContain("AUTH_SECRET=gizli");
    expect(result).toContain("# Veritabanı");
    expect(result).toContain("SMTP_PORT=1025");
  });
});
