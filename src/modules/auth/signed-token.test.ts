import { describe, expect, it } from "vitest";
import { validatePassword } from "./password-policy";
import { createSignedToken, verifySignedToken } from "./signed-token";

const secret = "x".repeat(32);
const now = new Date("2026-01-01T12:00:00Z");

describe("signed token", () => {
  const make = (ctx?: string) =>
    createSignedToken(
      { purpose: "verify-email", subject: "u1", ctx },
      { secret, ttlSeconds: 3600, now },
    );

  it("geçerli belirteci doğrular", () => {
    const result = verifySignedToken(make(), {
      secret,
      purpose: "verify-email",
      now,
    });
    expect(result).toMatchObject({
      valid: true,
      payload: { subject: "u1", purpose: "verify-email" },
    });
  });

  it("süresi dolan belirteci reddeder", () => {
    const later = new Date(now.getTime() + 2 * 3600 * 1000);
    expect(
      verifySignedToken(make(), {
        secret,
        purpose: "verify-email",
        now: later,
      }),
    ).toEqual({ valid: false, reason: "expired" });
  });

  it("başka amaçla kullanılmasını engeller", () => {
    expect(
      verifySignedToken(make(), { secret, purpose: "reset-password", now }),
    ).toEqual({ valid: false, reason: "purpose" });
  });

  it("farklı anahtarla imzalananı reddeder", () => {
    expect(
      verifySignedToken(make(), {
        secret: "y".repeat(32),
        purpose: "verify-email",
        now,
      }),
    ).toEqual({ valid: false, reason: "signature" });
  });

  it("içeriği değiştirilmiş belirteci reddeder", () => {
    const [, signature] = make().split(".");
    const forged = Buffer.from(
      JSON.stringify({
        purpose: "verify-email",
        subject: "admin",
        exp: 9999999999,
      }),
    ).toString("base64url");

    expect(
      verifySignedToken(`${forged}.${signature}`, {
        secret,
        purpose: "verify-email",
        now,
      }),
    ).toEqual({ valid: false, reason: "signature" });
  });

  it("bozuk biçimi reddeder", () => {
    for (const token of ["", "abc", "a.b.c"]) {
      expect(
        verifySignedToken(token, { secret, purpose: "verify-email", now }),
      ).toMatchObject({ valid: false });
    }
  });
});

describe("validatePassword", () => {
  it("kısa parolayı reddeder", () => {
    expect(validatePassword("abc123")).toContain("en az 10");
  });

  it("harf veya rakam eksikse reddeder", () => {
    expect(validatePassword("sadeceharfler")).toContain("harf ve bir rakam");
    expect(validatePassword("1234567890")).toContain("harf ve bir rakam");
  });

  it("geçerli parolayı kabul eder", () => {
    expect(validatePassword("güvenliparola1")).toBeNull();
  });
});
