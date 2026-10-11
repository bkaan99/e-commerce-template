import { describe, expect, it } from "vitest";
import {
  isSafeHref,
  parseInline,
  parseSimpleMarkdown,
} from "./simple-markdown";

describe("isSafeHref", () => {
  it.each([
    ["https://site.test/a", true],
    ["http://site.test", true],
    ["/iletisim", true],
    ["//evil.test", false],
    ["javascript:alert(1)", false],
    ["data:text/html,x", false],
    ["mailto:a@b.c", false],
  ])("%s → %s", (href, expected) => {
    expect(isSafeHref(href)).toBe(expected);
  });
});

describe("parseInline", () => {
  it("kalın ve bağlantıyı ayrıştırır", () => {
    expect(parseInline("Merhaba **dünya** [site](/a) son")).toEqual([
      { type: "text", text: "Merhaba " },
      { type: "bold", text: "dünya" },
      { type: "text", text: " " },
      { type: "link", text: "site", href: "/a" },
      { type: "text", text: " son" },
    ]);
  });

  it("güvenli olmayan bağlantının adresini atar, yalnızca metni bırakır", () => {
    expect(parseInline("[tıkla](javascript:alert)")).toEqual([
      { type: "text", text: "tıkla" },
    ]);
  });

  it("HTML etiketini olduğu gibi (metin) bırakır", () => {
    expect(parseInline("<script>alert(1)</script>")).toEqual([
      { type: "text", text: "<script>alert(1)</script>" },
    ]);
  });
});

describe("parseSimpleMarkdown", () => {
  it("başlık, paragraf ve listeyi bloklara ayırır", () => {
    const blocks = parseSimpleMarkdown(
      "# Hakkımızda\n\nİlk satır\nikinci satır\n\n## Değerler\n- Kalite\n- Hız\n",
    );

    expect(blocks.map((b) => b.type)).toEqual([
      "heading",
      "paragraph",
      "heading",
      "list",
    ]);
    expect(blocks[0]).toMatchObject({ type: "heading", level: 1 });
    expect(blocks[1]).toMatchObject({
      type: "paragraph",
      inlines: [{ type: "text", text: "İlk satır ikinci satır" }],
    });
    expect(blocks[3]).toMatchObject({ type: "list" });
    expect((blocks[3] as { items: unknown[] }).items).toHaveLength(2);
  });

  it("boş girdide blok üretmez", () => {
    expect(parseSimpleMarkdown("  \n \n")).toEqual([]);
  });
});
