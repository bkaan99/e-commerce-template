import { describe, expect, it } from "vitest";
import {
  MAX_IMAGE_BYTES,
  detectImageKind,
  validateImage,
} from "./image-validation";

const png = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0,
]);
const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0]);
const webp = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
]);
const gif = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

describe("detectImageKind", () => {
  it("içerik imzasına göre türü belirler", () => {
    expect(detectImageKind(png)?.extension).toBe("png");
    expect(detectImageKind(jpg)?.extension).toBe("jpg");
    expect(detectImageKind(webp)?.extension).toBe("webp");
    expect(detectImageKind(gif)?.extension).toBe("gif");
  });

  it("SVG ve HTML'i reddeder", () => {
    const svg = new TextEncoder().encode(
      "<svg xmlns='http://www.w3.org/2000/svg'/>",
    );
    const html = new TextEncoder().encode("<html><script>alert(1)</script>");
    expect(detectImageKind(svg)).toBeNull();
    expect(detectImageKind(html)).toBeNull();
  });
});

describe("validateImage", () => {
  it("boş ve büyük dosyaları reddeder", () => {
    expect(validateImage(new Uint8Array())).toMatchObject({ ok: false });
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(png);
    expect(validateImage(big)).toMatchObject({
      ok: false,
      message: expect.stringContaining("5 MB"),
    });
  });

  it("geçerli görseli kabul eder", () => {
    expect(validateImage(png)).toMatchObject({ ok: true });
  });
});
