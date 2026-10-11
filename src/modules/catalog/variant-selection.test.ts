import { describe, expect, it } from "vitest";
import type {
  ProductImageView,
  ProductOptionView,
  VariantView,
} from "./catalog.types";
import {
  defaultSelection,
  findVariant,
  imagesForSelection,
  isValueAvailable,
} from "./variant-selection";

const options: ProductOptionView[] = [
  {
    id: "renk",
    name: "Renk",
    values: [
      { id: "siyah", value: "Siyah" },
      { id: "beyaz", value: "Beyaz" },
    ],
  },
  {
    id: "beden",
    name: "Beden",
    values: [
      { id: "s", value: "S" },
      { id: "m", value: "M" },
    ],
  },
];

const variant = (
  id: string,
  values: string[],
  inStock: boolean,
): VariantView => ({
  id,
  sku: id,
  price: "100.00",
  compareAtPrice: null,
  currency: "TRY",
  inStock,
  availableQuantity: inStock ? 5 : 0,
  optionValueIds: values,
});

const variants = [
  variant("siyah-s", ["siyah", "s"], false),
  variant("siyah-m", ["siyah", "m"], true),
  variant("beyaz-s", ["beyaz", "s"], true),
  variant("beyaz-m", ["beyaz", "m"], false),
];

describe("variant selection", () => {
  it("seçime uyan varyantı bulur", () => {
    expect(
      findVariant(variants, options, { renk: "beyaz", beden: "s" })?.id,
    ).toBe("beyaz-s");
  });

  it("eksik seçimde varyant döndürmez", () => {
    expect(findVariant(variants, options, { renk: "beyaz" })).toBeNull();
  });

  it("seçeneksiz üründe tek varyantı döndürür", () => {
    const single = [variant("tek", [], true)];
    expect(findVariant(single, [], {})?.id).toBe("tek");
  });

  it("varsayılan seçim stokta olan ilk varyanttır", () => {
    expect(defaultSelection(variants, options)).toEqual({
      renk: "siyah",
      beden: "m",
    });
  });

  it("tükenmiş kombinasyonu seçilemez işaretler", () => {
    // Renk Siyah seçiliyken S bedeni stokta değil
    expect(
      isValueAvailable(variants, { renk: "siyah", beden: "m" }, "beden", "s"),
    ).toBe(false);
    expect(
      isValueAvailable(variants, { renk: "siyah", beden: "m" }, "beden", "m"),
    ).toBe(true);
  });

  it("seçili renge özel görselleri öne alır", () => {
    const images: ProductImageView[] = [
      { url: "genel.jpg", alt: "", optionValueId: null },
      { url: "siyah.jpg", alt: "", optionValueId: "siyah" },
      { url: "beyaz.jpg", alt: "", optionValueId: "beyaz" },
    ];
    expect(
      imagesForSelection(images, { renk: "siyah" }).map((i) => i.url),
    ).toEqual(["siyah.jpg"]);
    expect(imagesForSelection(images, {}).map((i) => i.url)).toEqual([
      "genel.jpg",
    ]);
  });
});
