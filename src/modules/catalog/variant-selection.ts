import type {
  ProductImageView,
  ProductOptionView,
  VariantView,
} from "./catalog.types";

/** seçenek kimliği → seçilen değer kimliği */
export type Selection = Record<string, string>;

function selectedValueIds(selection: Selection): string[] {
  return Object.values(selection);
}

/** Seçime tam uyan varyantı bulur. */
export function findVariant(
  variants: readonly VariantView[],
  options: readonly ProductOptionView[],
  selection: Selection,
): VariantView | null {
  if (options.length === 0) return variants[0] ?? null;
  if (Object.keys(selection).length < options.length) return null;

  const wanted = selectedValueIds(selection);
  return (
    variants.find(
      (variant) =>
        variant.optionValueIds.length === wanted.length &&
        wanted.every((id) => variant.optionValueIds.includes(id)),
    ) ?? null
  );
}

/** Varsayılan seçim: stokta olan ilk varyant, yoksa ilk varyant. */
export function defaultSelection(
  variants: readonly VariantView[],
  options: readonly ProductOptionView[],
): Selection {
  const variant = variants.find((v) => v.inStock) ?? variants[0];
  if (!variant) return {};

  const selection: Selection = {};
  for (const option of options) {
    const value = option.values.find((v) =>
      variant.optionValueIds.includes(v.id),
    );
    if (value) selection[option.id] = value.id;
  }
  return selection;
}

/**
 * Bir değerin, diğer seçenekler mevcut seçimdeyken stokta bir varyantla
 * eşleşip eşleşmediğini söyler (tükenmiş kombinasyonları işaretlemek için).
 */
export function isValueAvailable(
  variants: readonly VariantView[],
  selection: Selection,
  optionId: string,
  valueId: string,
): boolean {
  const others = Object.entries(selection)
    .filter(([id]) => id !== optionId)
    .map(([, value]) => value);

  return variants.some(
    (variant) =>
      variant.inStock &&
      variant.optionValueIds.includes(valueId) &&
      others.every((value) => variant.optionValueIds.includes(value)),
  );
}

/** Seçili renk gibi seçeneğe özel görselleri öne alır; yoksa genel görselleri döndürür. */
export function imagesForSelection(
  images: readonly ProductImageView[],
  selection: Selection,
): ProductImageView[] {
  const selected = new Set(selectedValueIds(selection));
  const specific = images.filter(
    (image) => image.optionValueId && selected.has(image.optionValueId),
  );
  if (specific.length > 0) return specific;

  const general = images.filter((image) => !image.optionValueId);
  return general.length > 0 ? general : [...images];
}
