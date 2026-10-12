import { describe, expect, it } from "vitest";
import { isValidVkn, vknCheckDigit } from "./vkn";

describe("isValidVkn", () => {
  it("sağlama hanesi doğru üretilen numarayı kabul eder", () => {
    for (const firstNine of [
      "123456789",
      "987654321",
      "100000000",
      "555555555",
    ]) {
      const vkn = `${firstNine}${vknCheckDigit(firstNine)}`;
      expect(isValidVkn(vkn)).toBe(true);
    }
  });

  it("sağlama hanesi yanlış numarayı reddeder", () => {
    const right = vknCheckDigit("123456789");
    const wrong = (right + 1) % 10;
    expect(isValidVkn(`123456789${wrong}`)).toBe(false);
  });

  it("10 hane olmayan veya rakam dışı girdiyi reddeder", () => {
    expect(isValidVkn("123456789")).toBe(false);
    expect(isValidVkn("12345678901")).toBe(false);
    expect(isValidVkn("12345abcde")).toBe(false);
    expect(isValidVkn("")).toBe(false);
  });
});
