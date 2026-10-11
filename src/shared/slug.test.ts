import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  it.each([
    ["Basic Tişört", "basic-tisort"],
    ["ÇOK GÜZEL ŞAPKA", "cok-guzel-sapka"],
    ["  Ürün   Adı!! ", "urun-adi"],
    ["İstanbul Işığı", "istanbul-isigi"],
    ["a/b\\c", "a-b-c"],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("çok uzun metni keser", () => {
    expect(slugify("a".repeat(200))).toHaveLength(80);
  });
});

describe("uniqueSlug", () => {
  it("çakışma yoksa olduğu gibi döner", async () => {
    expect(await uniqueSlug("Yeni Ürün", async () => false)).toBe("yeni-urun");
  });

  it("çakışmada sayı ekler", async () => {
    const taken = new Set(["yeni-urun", "yeni-urun-2"]);
    expect(await uniqueSlug("Yeni Ürün", async (s) => taken.has(s))).toBe(
      "yeni-urun-3",
    );
  });

  it("boş metinde varsayılan kök kullanır", async () => {
    expect(await uniqueSlug("!!!", async () => false)).toBe("urun");
  });
});
