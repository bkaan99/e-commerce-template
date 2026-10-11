import { describe, expect, it } from "vitest";
import { formatMoney, roundMoney, toDecimal } from "./money";

describe("money", () => {
  it("number kaynaklı kayan nokta hatası üretmez", () => {
    const total = toDecimal("0.1").plus("0.2");
    expect(total.toString()).toBe("0.3");
  });

  it("yarıdan yukarı 2 basamağa yuvarlar", () => {
    expect(roundMoney("10.005").toFixed(2)).toBe("10.01");
    expect(roundMoney("10.004").toFixed(2)).toBe("10.00");
  });

  it("TL olarak Türkçe biçimlendirir", () => {
    const formatted = formatMoney("1234.5");
    expect(formatted).toContain("1.234,50");
    expect(formatted).toContain("₺");
  });
});
