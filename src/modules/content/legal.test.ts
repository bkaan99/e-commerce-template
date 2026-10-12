import { describe, expect, it } from "vitest";
import { LEGAL_PAGES, publishedLegalLinks } from "./legal";

describe("publishedLegalLinks", () => {
  it("yalnızca yayındaki yasal sayfaları sabit sırayla döndürür", () => {
    const links = publishedLegalLinks([
      "cerez-politikasi",
      "hakkimizda",
      "mesafeli-satis-sozlesmesi",
    ]);
    expect(links.map((l) => l.slug)).toEqual([
      "mesafeli-satis-sozlesmesi",
      "cerez-politikasi",
    ]);
    expect(links[0]!.href).toBe("/sayfa/mesafeli-satis-sozlesmesi");
  });

  it("hiç sayfa yayında değilse boş döner", () => {
    expect(publishedLegalLinks([])).toEqual([]);
  });

  it("slug'lar benzersizdir", () => {
    const slugs = LEGAL_PAGES.map((page) => page.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
