import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { PaytrProvider } from "./paytr-provider";
import { signCallback, signTokenRequest } from "./paytr-signature";

const credentials = {
  merchantId: "123456",
  merchantKey: "test-key",
  merchantSalt: "test-salt",
};

const request = {
  merchantOid: "ORD1234",
  amount: "649.90",
  currency: "TRY",
  email: "ali@example.com",
  customerName: "Ali Veli",
  customerPhone: "05550000000",
  customerAddress: "Örnek Mah. 1. Sk. No:2 İstanbul",
  customerIp: "1.2.3.4",
  description: "Sipariş ORD1234",
  okUrl: "https://site.test/ok",
  failUrl: "https://site.test/fail",
};

const hmac = (data: string) =>
  createHmac("sha256", credentials.merchantKey).update(data).digest("base64");

describe("PayTR imzaları", () => {
  it("token imzası dokümandaki alan sırasını kullanır", () => {
    const signature = signTokenRequest({
      merchantId: "1",
      userIp: "2",
      merchantOid: "3",
      email: "4",
      paymentAmount: "5",
      userBasket: "6",
      noInstallment: "7",
      maxInstallment: "8",
      currency: "9",
      testMode: "0",
      merchantSalt: "S",
      merchantKey: "K",
    });
    expect(signature).toBe(
      createHmac("sha256", "K").update("1234567890S").digest("base64"),
    );
  });

  it("callback imzası oid + salt + status + tutar sırasındadır", () => {
    const signature = signCallback({
      merchantOid: "ORD1",
      merchantSalt: "salt",
      status: "success",
      totalAmount: "64990",
      merchantKey: "key",
    });
    expect(signature).toBe(
      createHmac("sha256", "key")
        .update("ORD1saltsuccess64990")
        .digest("base64"),
    );
  });
});

describe("PaytrProvider.initiate", () => {
  it("imzalı isteği gönderir ve ödeme adresini döndürür", async () => {
    const http = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        const body = init?.body as URLSearchParams;
        expect(body.get("merchant_oid")).toBe("ORD1234");
        expect(body.get("payment_amount")).toBe("649.90");
        expect(body.get("currency")).toBe("TL");
        expect(body.get("test_mode")).toBe("1");

        const expected = hmac(
          `123456${"1.2.3.4"}ORD1234ali@example.com649.90${body.get("user_basket")}00TL1test-salt`,
        );
        expect(body.get("paytr_token")).toBe(expected);

        return new Response(
          JSON.stringify({ status: "success", token: "abc123" }),
        );
      },
    );

    const provider = new PaytrProvider(
      credentials,
      { testMode: true },
      http as unknown as typeof fetch,
    );
    const result = await provider.initiate(request);

    expect(result).toEqual({
      token: "abc123",
      paymentUrl: "https://www.paytr.com/odeme/guvenli/abc123",
      mode: "iframe",
    });
  });

  it("PayTR hata dönerse ExternalServiceError fırlatır", async () => {
    const http = vi.fn(
      async () =>
        new Response(JSON.stringify({ status: "failed", reason: "Geçersiz" })),
    );
    const provider = new PaytrProvider(
      credentials,
      {},
      http as unknown as typeof fetch,
    );

    await expect(provider.initiate(request)).rejects.toThrow(
      "PayTR servisinden hata alındı",
    );
  });
});

describe("PaytrProvider.verifyCallback", () => {
  const provider = new PaytrProvider(credentials);
  const valid = (overrides: Record<string, string> = {}) => {
    const payload = {
      merchant_oid: "ORD1234",
      status: "success",
      total_amount: "64990",
      ...overrides,
    };
    return {
      ...payload,
      hash: signCallback({
        merchantOid: payload.merchant_oid,
        merchantSalt: credentials.merchantSalt,
        status: payload.status,
        totalAmount: payload.total_amount,
        merchantKey: credentials.merchantKey,
      }),
    };
  };

  it("geçerli bildirimi çözer ve kuruşu TL'ye çevirir", () => {
    expect(provider.verifyCallback(valid())).toEqual({
      merchantOid: "ORD1234",
      status: "success",
      amount: "649.90",
      failureReason: null,
    });
  });

  it("başarısız ödemede nedeni döndürür", () => {
    const result = provider.verifyCallback(
      valid({ status: "failed", failed_reason_msg: "Yetersiz bakiye" }),
    );
    expect(result.status).toBe("failed");
    expect(result.failureReason).toBe("Yetersiz bakiye");
  });

  it("imzası bozuk bildirimi reddeder", () => {
    expect(() =>
      provider.verifyCallback({ ...valid(), total_amount: "1" }),
    ).toThrow("Geçersiz bildirim imzası");
  });

  it("eksik alanı reddeder", () => {
    expect(() => provider.verifyCallback({ status: "success" })).toThrow(
      "Eksik bildirim alanı",
    );
  });
});

describe("PaytrProvider.refund", () => {
  it("başarılı iadede sağlayıcı referansını döndürür", async () => {
    const http = vi.fn(
      async () => new Response(JSON.stringify({ status: "success" })),
    );
    const provider = new PaytrProvider(
      credentials,
      {},
      http as unknown as typeof fetch,
    );
    expect(
      await provider.refund({ merchantOid: "ORD1234", amount: "100.00" }),
    ).toEqual({ providerRef: "ORD1234" });
  });

  it("hata dönerse fırlatır", async () => {
    const http = vi.fn(
      async () =>
        new Response(JSON.stringify({ status: "error", err_msg: "Yetersiz" })),
    );
    const provider = new PaytrProvider(
      credentials,
      {},
      http as unknown as typeof fetch,
    );
    await expect(
      provider.refund({ merchantOid: "ORD1234", amount: "100.00" }),
    ).rejects.toThrow("PayTR iade");
  });
});
