import { describe, expect, it } from "vitest";
import {
  addressSchema,
  checkoutSchema,
  isValidTckn,
  normalizeTurkishMobile,
} from "./checkout.schema";

const baseAddress = {
  firstName: "Ali",
  lastName: "Veli",
  phone: "0555 000 00 00",
  city: "İstanbul",
  district: "Kadıköy",
  addressLine: "Örnek Sokak No: 12 Daire 3",
};

describe("normalizeTurkishMobile", () => {
  it.each([
    ["0555 123 45 67", "05551234567"],
    ["+90 555 123 45 67", "05551234567"],
    ["5551234567", "05551234567"],
    ["(0555) 123-45-67", "05551234567"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeTurkishMobile(input)).toBe(expected);
  });

  it("geçersiz numarada null döner", () => {
    expect(normalizeTurkishMobile("0212 123 45 67")).toBeNull();
    expect(normalizeTurkishMobile("123")).toBeNull();
  });
});

describe("isValidTckn", () => {
  it("geçerli T.C. kimlik numarasını kabul eder", () => {
    expect(isValidTckn("10000000146")).toBe(true);
  });

  it("geçersiz numaraları reddeder", () => {
    expect(isValidTckn("12345678901")).toBe(false);
    expect(isValidTckn("00000000000")).toBe(false);
    expect(isValidTckn("1000000014")).toBe(false);
  });
});

describe("addressSchema", () => {
  it("bireysel adresi telefonu normalleştirerek kabul eder", () => {
    const result = addressSchema.parse(baseAddress);
    expect(result.phone).toBe("05550000000");
    expect(result.invoiceType).toBe("INDIVIDUAL");
  });

  it("kurumsal faturada firma, vergi no ve vergi dairesini zorunlu kılar", () => {
    const result = addressSchema.safeParse({
      ...baseAddress,
      invoiceType: "CORPORATE",
    });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((issue) => issue.path[0]);
    expect(paths).toEqual(
      expect.arrayContaining(["companyName", "taxNumber", "taxOffice"]),
    );
  });

  it("geçerli kurumsal adresi kabul eder", () => {
    const result = addressSchema.safeParse({
      ...baseAddress,
      invoiceType: "CORPORATE",
      companyName: "Örnek A.Ş.",
      taxNumber: "1234567890",
      taxOffice: "Kadıköy",
    });
    expect(result.success).toBe(true);
  });

  it("geçersiz TCKN'yi reddeder", () => {
    const result = addressSchema.safeParse({
      ...baseAddress,
      nationalId: "12345678901",
    });
    expect(result.success).toBe(false);
  });
});

describe("checkoutSchema", () => {
  const valid = {
    email: "  ALI@Example.com ",
    shippingAddress: baseAddress,
    acceptTerms: true,
  };

  it("e-postayı normalleştirir, kuponu büyük harfe çevirir", () => {
    const result = checkoutSchema.parse({ ...valid, couponCode: " yaz10 " });
    expect(result.email).toBe("ali@example.com");
    expect(result.couponCode).toBe("YAZ10");
  });

  it("sözleşme onayı olmadan reddeder", () => {
    expect(
      checkoutSchema.safeParse({ ...valid, acceptTerms: false }).success,
    ).toBe(false);
  });
});
