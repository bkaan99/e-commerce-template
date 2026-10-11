import { describe, expect, it } from "vitest";
import { EnvValidationError, parseEnv } from "./env";

const validSource = {
  NODE_ENV: "development",
  APP_URL: "http://localhost:3000",
  AUTH_SECRET: "a".repeat(32),
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  SMTP_HOST: "localhost",
  SMTP_PORT: "1025",
  MAIL_FROM: "no-reply@localhost",
};

const captchaOff = { captcha: false };

describe("parseEnv", () => {
  it("geçerli değerleri tiplerine çevirir", () => {
    const env = parseEnv(validSource, captchaOff);
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.NODE_ENV).toBe("development");
  });

  it("kısa AUTH_SECRET'ı reddeder", () => {
    expect(() =>
      parseEnv({ ...validSource, AUTH_SECRET: "kisa" }, captchaOff),
    ).toThrow(EnvValidationError);
  });

  it("geçersiz APP_URL'yi reddeder", () => {
    expect(() =>
      parseEnv({ ...validSource, APP_URL: "adres-degil" }, captchaOff),
    ).toThrow(EnvValidationError);
  });

  it("boş string'i tanımsız sayar", () => {
    const env = parseEnv({ ...validSource, PAYTR_MERCHANT_ID: "" }, captchaOff);
    expect(env.PAYTR_MERCHANT_ID).toBeUndefined();
  });

  it("production'da PayTR anahtarlarını zorunlu kılar", () => {
    expect(() =>
      parseEnv({ ...validSource, NODE_ENV: "production" }, captchaOff),
    ).toThrow(/PAYTR_MERCHANT_ID/);
  });

  it("production'da PayTR anahtarları varsa kabul eder", () => {
    const env = parseEnv(
      {
        ...validSource,
        NODE_ENV: "production",
        PAYTR_MERCHANT_ID: "1",
        PAYTR_MERCHANT_KEY: "k",
        PAYTR_MERCHANT_SALT: "s",
      },
      captchaOff,
    );
    expect(env.PAYTR_MERCHANT_KEY).toBe("k");
  });

  it("captcha açıkken Turnstile anahtarlarını zorunlu kılar", () => {
    expect(() => parseEnv(validSource, { captcha: true })).toThrow(
      /TURNSTILE_SITE_KEY/,
    );
  });

  it("captcha kapalıyken Turnstile anahtarı istemez", () => {
    expect(() => parseEnv(validSource, captchaOff)).not.toThrow();
  });
});
