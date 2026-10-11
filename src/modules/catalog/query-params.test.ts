import { describe, expect, it } from "vitest";
import { parseListQuery, toSearchString } from "./query-params";

describe("parseListQuery", () => {
  it("boş parametrelerde varsayılanları kullanır", () => {
    const query = parseListQuery({});
    expect(query).toMatchObject({
      sort: "newest",
      page: 1,
      brandSlugs: [],
      attributeFilters: {},
    });
    expect(query.search).toBeUndefined();
  });

  it("filtre, arama, sıralama ve sayfayı okur", () => {
    const query = parseListQuery(
      {
        q: "  tişört ",
        sirala: "price-asc",
        sayfa: "3",
        marka: "nike,adidas",
        "fiyat-min": "100",
        "fiyat-max": "500",
        "f.kumas": "pamuk,keten",
      },
      { categorySlug: "giyim" },
    );

    expect(query).toMatchObject({
      categorySlug: "giyim",
      search: "tişört",
      sort: "price-asc",
      page: 3,
      brandSlugs: ["nike", "adidas"],
      minPrice: 100,
      maxPrice: 500,
      attributeFilters: { kumas: ["pamuk", "keten"] },
    });
  });

  it("geçersiz değerleri yok sayar", () => {
    const query = parseListQuery({
      sirala: "rastgele",
      sayfa: "-4",
      "fiyat-min": "abc",
    });
    expect(query.sort).toBe("newest");
    expect(query.page).toBe(1);
    expect(query.minPrice).toBeUndefined();
  });

  it("sayfa boyutunu üst sınırla kısıtlar", () => {
    expect(parseListQuery({}, { pageSize: 5000 }).pageSize).toBe(60);
  });

  it("çok uzun aramayı keser", () => {
    expect(parseListQuery({ q: "a".repeat(500) }).search).toHaveLength(100);
  });
});

describe("toSearchString", () => {
  it("varsayılan değerleri URL'ye yazmaz", () => {
    expect(toSearchString({ sort: "newest", page: 1 })).toBe("");
  });

  it("parse edilen sorguyu geri üretir", () => {
    const original = {
      q: "tişört",
      sirala: "price-desc",
      marka: "nike",
      "f.kumas": "pamuk",
      sayfa: "2",
    };
    const text = toSearchString(parseListQuery(original));
    const params = new URLSearchParams(text);

    expect(params.get("q")).toBe("tişört");
    expect(params.get("sirala")).toBe("price-desc");
    expect(params.get("marka")).toBe("nike");
    expect(params.get("f.kumas")).toBe("pamuk");
    expect(params.get("sayfa")).toBe("2");
  });

  it("sayfa değerini ezebilir", () => {
    expect(toSearchString({ page: 5 }, { page: 1 })).toBe("");
  });
});
