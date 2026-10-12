"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  EditableProduct,
  FormReferences,
} from "@/modules/admin/catalog/product-admin.repository";
import { generateCombinations } from "@/modules/admin/catalog/product.schema";
import { saveProductAction } from "./actions";

interface VariantRow {
  id?: string;
  sku: string;
  barcode: string;
  price: string;
  compareAtPrice: string;
  stockQuantity: string;
  isActive: boolean;
  optionValues: Record<string, string>;
}

interface ImageRow {
  url: string;
  alt: string;
  forOption: string; // "Renk\u0000Siyah" veya ""
}

interface OptionRow {
  name: string;
  values: string;
}

const emptyProduct: EditableProduct = {
  id: "",
  name: "",
  slug: "",
  description: "",
  status: "DRAFT",
  categoryId: "",
  brandId: null,
  taxRate: "20",
  trackInventory: true,
  isFeatured: false,
  desi: null,
  weightGram: null,
  seoTitle: "",
  seoDescription: "",
  attributeValueIds: [],
  options: [],
  variants: [],
  images: [],
};

function comboKey(
  options: OptionRow[],
  values: Record<string, string>,
): string {
  return options.map((option) => values[option.name.trim()] ?? "").join("|");
}

function parseValues(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {children}
      {error ? (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function ProductForm({
  product,
  references,
  mode,
}: {
  product?: EditableProduct;
  references: FormReferences;
  mode: "create" | "edit";
}) {
  const initial = product ?? emptyProduct;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(mode === "edit" ? initial.slug : "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [status, setStatus] = useState(initial.status);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [brandId, setBrandId] = useState(initial.brandId ?? "");
  const [taxRate, setTaxRate] = useState(initial.taxRate);
  const [trackInventory, setTrackInventory] = useState(initial.trackInventory);
  const [isFeatured, setIsFeatured] = useState(initial.isFeatured);
  const [desi, setDesi] = useState(initial.desi ?? "");
  const [weightGram, setWeightGram] = useState(
    initial.weightGram === null ? "" : String(initial.weightGram),
  );
  const [seoTitle, setSeoTitle] = useState(initial.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(
    initial.seoDescription ?? "",
  );
  const [attributeValueIds, setAttributeValueIds] = useState<string[]>(
    initial.attributeValueIds,
  );
  const [options, setOptions] = useState<OptionRow[]>(
    initial.options.map((o) => ({ name: o.name, values: o.values.join(", ") })),
  );
  const [variants, setVariants] = useState<VariantRow[]>(
    initial.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      barcode: v.barcode ?? "",
      price: v.price,
      compareAtPrice: v.compareAtPrice ?? "",
      stockQuantity: String(v.stockQuantity),
      isActive: v.isActive,
      optionValues: v.optionValues,
    })),
  );
  const [images, setImages] = useState<ImageRow[]>(
    initial.images.map((image) => ({
      url: image.url,
      alt: image.alt ?? "",
      forOption: image.forOption
        ? `${image.forOption.option}\u0000${image.forOption.value}`
        : "",
    })),
  );

  const [uploadError, setUploadError] = useState<string | null>(null);

  async function uploadImage(file: File, index: number) {
    setUploadError(null);
    const body = new FormData();
    body.set("file", file);

    try {
      const response = await fetch("/admin/yukle", { method: "POST", body });
      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.url) {
        setUploadError(result.error ?? "Yükleme başarısız");
        return;
      }
      const url = result.url;
      setImages((rows) =>
        rows.map((row, i) => (i === index ? { ...row, url } : row)),
      );
    } catch {
      setUploadError("Yükleme başarısız, bağlantınızı kontrol edin");
    }
  }

  const parsedOptions = useMemo(
    () =>
      options
        .map((option) => ({
          name: option.name.trim(),
          values: parseValues(option.values),
        }))
        .filter((option) => option.name && option.values.length > 0),
    [options],
  );

  function generateVariants() {
    const combos = generateCombinations(parsedOptions);
    const existing = new Map(
      variants.map((v) => [comboKey(options, v.optionValues), v]),
    );
    const basePrice = variants[0]?.price ?? "";
    const baseSku = (slug || name || "URUN")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .slice(0, 24);

    setVariants(
      combos.map((combo) => {
        const found = existing.get(comboKey(options, combo));
        if (found) return { ...found, optionValues: combo };

        const suffix = Object.values(combo)
          .map((value) => value.toUpperCase().replace(/[^A-Z0-9]+/g, ""))
          .join("-");
        return {
          sku: suffix ? `${baseSku}-${suffix}` : baseSku,
          barcode: "",
          price: basePrice,
          compareAtPrice: "",
          stockQuantity: "0",
          isActive: true,
          optionValues: combo,
        };
      }),
    );
  }

  function updateVariant(index: number, patch: Partial<VariantRow>) {
    setVariants((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function toggleAttribute(valueId: string) {
    setAttributeValueIds((ids) =>
      ids.includes(valueId)
        ? ids.filter((id) => id !== valueId)
        : [...ids, valueId],
    );
  }

  function submit() {
    setError(null);
    setSaved(false);

    const payload = {
      name,
      slug,
      description,
      status,
      categoryId,
      brandId,
      taxRate,
      trackInventory,
      isFeatured,
      desi,
      weightGram,
      seoTitle,
      seoDescription,
      attributeValueIds,
      options: parsedOptions,
      variants: variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        barcode: variant.barcode,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        stockQuantity: variant.stockQuantity,
        isActive: variant.isActive,
        optionValues: variant.optionValues,
      })),
      images: images
        .filter((image) => image.url.trim())
        .map((image) => {
          const [option, value] = image.forOption.split("\u0000");
          return {
            url: image.url,
            alt: image.alt,
            forOption:
              image.forOption && option && value ? { option, value } : null,
          };
        }),
    };

    startTransition(async () => {
      const result = await saveProductAction(
        mode === "edit" ? initial.id : null,
        payload,
      );
      if (!result.ok) {
        setError(result.error ?? "Kaydedilemedi");
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      setFieldErrors({});
      if (mode === "create" && result.id) {
        router.push(`/admin/urunler/${result.id}`);
      } else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  const imageOptionChoices = parsedOptions.flatMap((option) =>
    option.values.map((value) => ({
      key: `${option.name}\u0000${value}`,
      label: `${option.name}: ${value}`,
    })),
  );

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      {error ? (
        <p
          role="alert"
          className="rounded-theme border border-red-300 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}
      {saved ? (
        <p
          role="status"
          className="rounded-theme border border-green-300 bg-green-50 p-3 text-sm text-green-800"
        >
          Ürün kaydedildi.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Temel bilgiler</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Ürün adı" error={fieldErrors["name"]}>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <Field label="Adres (slug)" error={fieldErrors["slug"]}>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="Boş bırakılırsa addan üretilir"
            />
          </Field>
          <Field label="Durum" error={fieldErrors["status"]}>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              <option value="DRAFT">Taslak</option>
              <option value="ACTIVE">Yayında</option>
              <option value="ARCHIVED">Arşiv</option>
            </Select>
          </Field>
          <Field label="Kategori" error={fieldErrors["categoryId"]}>
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Seçin</option>
              {references.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Marka">
            <Select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
            >
              <option value="">Marka yok</option>
              {references.brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Açıklama" error={fieldErrors["description"]}>
              <Textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
          </div>
          <Field label="KDV oranı (%)" error={fieldErrors["taxRate"]}>
            <Input
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              inputMode="decimal"
            />
          </Field>
          <div className="flex flex-col justify-end gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={trackInventory}
                onChange={(e) => setTrackInventory(e.target.checked)}
              />
              Stok takibi yap
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
              />
              Ana sayfada öne çıkar
            </label>
          </div>
          <Field label="Desi" error={fieldErrors["desi"]}>
            <Input
              value={desi}
              onChange={(e) => setDesi(e.target.value)}
              inputMode="decimal"
            />
          </Field>
          <Field label="Ağırlık (gram)" error={fieldErrors["weightGram"]}>
            <Input
              value={weightGram}
              onChange={(e) => setWeightGram(e.target.value)}
              inputMode="numeric"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seçenekler ve varyantlar</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Her seçenek için değerleri virgülle ayırın (örn. Renk: Siyah,
            Beyaz). Ardından varyantları oluşturun. Mevcut varyantlar korunur;
            listede olmayanlar pasifleştirilir.
          </p>

          {options.map((option, index) => (
            <div
              key={index}
              className="grid items-end gap-2 sm:grid-cols-[180px_1fr_auto]"
            >
              <Field label="Seçenek adı">
                <Input
                  value={option.name}
                  onChange={(e) =>
                    setOptions((rows) =>
                      rows.map((r, i) =>
                        i === index ? { ...r, name: e.target.value } : r,
                      ),
                    )
                  }
                  placeholder="Renk"
                />
              </Field>
              <Field label="Değerler">
                <Input
                  value={option.values}
                  onChange={(e) =>
                    setOptions((rows) =>
                      rows.map((r, i) =>
                        i === index ? { ...r, values: e.target.value } : r,
                      ),
                    )
                  }
                  placeholder="Siyah, Beyaz"
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setOptions((rows) => rows.filter((_, i) => i !== index))
                }
              >
                Kaldır
              </Button>
            </div>
          ))}
          {fieldErrors["options"] ? (
            <span role="alert" className="text-xs text-red-600">
              {fieldErrors["options"]}
            </span>
          ) : null}

          <div className="flex gap-2">
            {options.length < 3 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setOptions((rows) => [...rows, { name: "", values: "" }])
                }
              >
                Seçenek ekle
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={generateVariants}>
              {options.length === 0 && variants.length === 0
                ? "Tek varyant oluştur"
                : "Varyantları oluştur"}
            </Button>
          </div>

          {variants.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Seçenekler</th>
                    <th className="px-2 py-2">SKU</th>
                    <th className="px-2 py-2">Fiyat</th>
                    <th className="px-2 py-2">Eski fiyat</th>
                    <th className="px-2 py-2">Stok</th>
                    <th className="px-2 py-2">Aktif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {variants.map((variant, index) => (
                    <tr key={variant.id ?? `new-${index}`}>
                      <td className="px-2 py-2">
                        {Object.values(variant.optionValues).join(" / ") ||
                          "Standart"}
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          value={variant.sku}
                          onChange={(e) =>
                            updateVariant(index, { sku: e.target.value })
                          }
                          aria-invalid={Boolean(
                            fieldErrors[`variants.${index}.sku`],
                          )}
                        />
                        {fieldErrors[`variants.${index}.sku`] ? (
                          <span className="text-xs text-red-600">
                            {fieldErrors[`variants.${index}.sku`]}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          value={variant.price}
                          onChange={(e) =>
                            updateVariant(index, { price: e.target.value })
                          }
                          inputMode="decimal"
                          className="w-28"
                        />
                        {fieldErrors[`variants.${index}.price`] ? (
                          <span className="text-xs text-red-600">
                            {fieldErrors[`variants.${index}.price`]}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          value={variant.compareAtPrice}
                          onChange={(e) =>
                            updateVariant(index, {
                              compareAtPrice: e.target.value,
                            })
                          }
                          inputMode="decimal"
                          className="w-28"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          value={variant.stockQuantity}
                          onChange={(e) =>
                            updateVariant(index, {
                              stockQuantity: e.target.value,
                            })
                          }
                          inputMode="numeric"
                          className="w-24"
                        />
                        {fieldErrors[`variants.${index}.stockQuantity`] ? (
                          <span className="text-xs text-red-600">
                            {fieldErrors[`variants.${index}.stockQuantity`]}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={variant.isActive}
                          onChange={(e) =>
                            updateVariant(index, { isActive: e.target.checked })
                          }
                          aria-label="Aktif"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {fieldErrors["variants"] ? (
            <span role="alert" className="text-xs text-red-600">
              {fieldErrors["variants"]}
            </span>
          ) : null}
        </CardContent>
      </Card>

      {references.attributes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nitelikler (filtrelerde kullanılır)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {references.attributes.map((attribute) => (
              <fieldset key={attribute.id} className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">
                  {attribute.name}
                </legend>
                <div className="flex flex-wrap gap-3 text-sm">
                  {attribute.values.map((value) => (
                    <label key={value.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={attributeValueIds.includes(value.id)}
                        onChange={() => toggleAttribute(value.id)}
                      />
                      {value.value}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Görseller</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Görsel yükleyin (JPEG, PNG, WebP, GIF — en fazla 5 MB) veya adres
            girin (https://… veya /yol). Bir seçenek seçerseniz görsel yalnızca
            o seçenek (örn. renk) seçilince gösterilir.
          </p>
          {uploadError ? (
            <p role="alert" className="text-sm text-red-600">
              {uploadError}
            </p>
          ) : null}
          {images.map((image, index) => (
            <div
              key={index}
              className="grid gap-2 sm:grid-cols-[1fr_1fr_200px_auto]"
            >
              <div className="flex flex-col gap-1">
                <Input
                  value={image.url}
                  placeholder="Görsel adresi"
                  aria-label="Görsel adresi"
                  onChange={(e) =>
                    setImages((rows) =>
                      rows.map((r, i) =>
                        i === index ? { ...r, url: e.target.value } : r,
                      ),
                    )
                  }
                />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  aria-label="Dosyadan yükle"
                  className="text-xs"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadImage(file, index);
                    e.target.value = "";
                  }}
                />
              </div>
              <Input
                value={image.alt}
                placeholder="Alternatif metin"
                aria-label="Alternatif metin"
                onChange={(e) =>
                  setImages((rows) =>
                    rows.map((r, i) =>
                      i === index ? { ...r, alt: e.target.value } : r,
                    ),
                  )
                }
              />
              <Select
                value={image.forOption}
                aria-label="Seçeneğe özel"
                onChange={(e) =>
                  setImages((rows) =>
                    rows.map((r, i) =>
                      i === index ? { ...r, forOption: e.target.value } : r,
                    ),
                  )
                }
              >
                <option value="">Tüm seçenekler</option>
                {imageOptionChoices.map((choice) => (
                  <option key={choice.key} value={choice.key}>
                    {choice.label}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setImages((rows) => rows.filter((_, i) => i !== index))
                }
              >
                Kaldır
              </Button>
              {fieldErrors[`images.${index}.url`] ? (
                <span className="text-xs text-red-600 sm:col-span-4">
                  {fieldErrors[`images.${index}.url`]}
                </span>
              ) : null}
            </div>
          ))}
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setImages((rows) => [
                  ...rows,
                  { url: "", alt: "", forOption: "" },
                ])
              }
            >
              Görsel ekle
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Arama motoru (SEO)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field
            label="SEO başlığı (en çok 70)"
            error={fieldErrors["seoTitle"]}
          >
            <Input
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              maxLength={70}
            />
          </Field>
          <Field
            label="SEO açıklaması (en çok 160)"
            error={fieldErrors["seoDescription"]}
          >
            <Textarea
              rows={2}
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              maxLength={160}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="button" size="lg" disabled={pending} onClick={submit}>
          {pending ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </div>
    </div>
  );
}
