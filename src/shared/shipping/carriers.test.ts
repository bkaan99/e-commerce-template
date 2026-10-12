import { describe, expect, it } from "vitest";
import { CARRIER_NAMES, trackingUrl } from "./carriers";

describe("trackingUrl", () => {
  it("firma şablonuna takip numarasını güvenli biçimde yerleştirir", () => {
    expect(trackingUrl("Aras Kargo", "123 456")).toBe(
      "https://kargotakip.araskargo.com.tr/mainpage.aspx?code=123%20456",
    );
  });

  it("bilinmeyen firma, 'Diğer' veya eksik takip numarası için null döner", () => {
    expect(trackingUrl("Bilinmeyen", "123")).toBeNull();
    expect(trackingUrl("Diğer", "123")).toBeNull();
    expect(trackingUrl("Aras Kargo", " ")).toBeNull();
    expect(trackingUrl(null, "123")).toBeNull();
  });

  it("firma adları benzersizdir", () => {
    expect(new Set(CARRIER_NAMES).size).toBe(CARRIER_NAMES.length);
  });
});
