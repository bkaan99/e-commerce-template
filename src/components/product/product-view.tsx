"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { addToCartAction } from "@/app/(storefront)/sepet/actions";
import { StockAlertForm } from "./stock-alert-form";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { Price } from "@/components/storefront/price";
import type { ProductDetail } from "@/modules/catalog/catalog.types";
import {
  defaultSelection,
  findVariant,
  imagesForSelection,
  isValueAvailable,
  type Selection,
} from "@/modules/catalog/variant-selection";
import { trackEvent } from "@/shared/analytics/client";

const MAX_QUANTITY = 99;

export function ProductView({
  product,
  wishlistEnabled,
}: {
  product: ProductDetail;
  wishlistEnabled: boolean;
}) {
  const [selection, setSelection] = useState<Selection>(() =>
    defaultSelection(product.variants, product.options),
  );
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const variant = useMemo(
    () => findVariant(product.variants, product.options, selection),
    [product, selection],
  );
  const images = useMemo(
    () => imagesForSelection(product.images, selection),
    [product.images, selection],
  );
  const image = images[Math.min(imageIndex, images.length - 1)]!;

  const maxQuantity = Math.min(
    variant?.availableQuantity ?? MAX_QUANTITY,
    MAX_QUANTITY,
  );
  const canBuy = product.priceVisible && variant !== null && variant.inStock;

  function select(optionId: string, valueId: string) {
    setSelection((current) => ({ ...current, [optionId]: valueId }));
    setImageIndex(0);
    setQuantity(1);
    setMessage(null);
  }

  function addToCart() {
    if (!variant) return;

    startTransition(async () => {
      const result = await addToCartAction(variant.id, quantity);
      if (!result.ok) {
        setMessage({ text: result.error ?? "Sepete eklenemedi", error: true });
        return;
      }

      setMessage({ text: "Ürün sepete eklendi", error: false });
      const unit = Number(variant.price);
      trackEvent("add_to_cart", {
        currency: variant.currency,
        value: unit * quantity,
        item: {
          id: product.id,
          name: product.name,
          price: unit,
          quantity,
          variant: variant.sku,
          brand: product.brand?.name ?? null,
        },
      });
    });
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div className="relative aspect-square overflow-hidden rounded-theme bg-muted">
          <Image
            src={image.url}
            alt={image.alt}
            fill
            priority
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
        {images.length > 1 ? (
          <ul className="flex gap-2">
            {images.map((item, index) => (
              <li key={`${item.url}-${index}`}>
                <button
                  type="button"
                  onClick={() => setImageIndex(index)}
                  aria-label={`Görsel ${index + 1}`}
                  aria-current={index === imageIndex}
                  className="relative h-16 w-16 overflow-hidden rounded-theme border border-border"
                >
                  <Image
                    src={item.url}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          {product.brand ? (
            <span className="text-sm text-muted-foreground">
              {product.brand.name}
            </span>
          ) : null}
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-semibold">{product.name}</h1>
            {wishlistEnabled ? <WishlistButton productId={product.id} /> : null}
          </div>
        </div>

        {!product.priceVisible ? (
          <p className="rounded-theme border border-border p-3 text-sm">
            Fiyatları görmek için bayi girişi yapın.{" "}
            <a href="/giris" className="underline">
              Giriş yap
            </a>{" "}
            veya{" "}
            <a href="/bayi-basvuru" className="underline">
              bayi olun
            </a>
            .
          </p>
        ) : variant ? (
          <div className="text-lg">
            <Price
              value={variant.price}
              compareAt={variant.compareAtPrice}
              currency={variant.currency}
            />
            <p className="mt-1 text-xs text-muted-foreground">KDV dahil</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Fiyatı görmek için seçenekleri belirleyin.
          </p>
        )}

        {product.options.map((option) => (
          <fieldset key={option.id} className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{option.name}</legend>
            <div className="flex flex-wrap gap-2">
              {option.values.map((value) => {
                const active = selection[option.id] === value.id;
                const available = isValueAvailable(
                  product.variants,
                  selection,
                  option.id,
                  value.id,
                );

                return (
                  <button
                    key={value.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => select(option.id, value.id)}
                    className={[
                      "rounded-theme border px-3 py-2 text-sm",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border",
                      available ? "" : "opacity-40 line-through",
                    ].join(" ")}
                  >
                    {value.value}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div className="flex items-center gap-3">
          <label className="text-sm font-medium" htmlFor="quantity">
            Adet
          </label>
          <input
            id="quantity"
            type="number"
            min={1}
            max={maxQuantity}
            value={quantity}
            onChange={(event) => {
              const next = Math.floor(Number(event.target.value));
              setQuantity(Math.min(Math.max(1, next || 1), maxQuantity));
            }}
            className="w-20 rounded-theme border border-border px-2 py-2 text-sm"
          />
        </div>

        <button
          type="button"
          onClick={addToCart}
          disabled={!canBuy || pending}
          className="rounded-theme bg-primary px-6 py-3 text-primary-foreground disabled:opacity-50"
        >
          {pending
            ? "Ekleniyor..."
            : !variant
              ? "Seçenekleri belirleyin"
              : variant.inStock
                ? "Sepete ekle"
                : "Tükendi"}
        </button>

        {variant && !variant.inStock ? (
          <StockAlertForm key={variant.id} variantId={variant.id} />
        ) : null}

        {variant?.inStock &&
        variant.availableQuantity !== null &&
        variant.availableQuantity <= 5 ? (
          <p className="text-sm text-amber-700">
            Son {variant.availableQuantity} ürün
          </p>
        ) : null}

        {message ? (
          <p
            role={message.error ? "alert" : "status"}
            className={
              message.error ? "text-sm text-red-600" : "text-sm text-green-700"
            }
          >
            {message.text}
          </p>
        ) : null}

        {product.description ? (
          <section className="flex flex-col gap-2 border-t border-border pt-4">
            <h2 className="text-sm font-medium">Ürün açıklaması</h2>
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {product.description}
            </p>
          </section>
        ) : null}

        {product.attributes.length > 0 ? (
          <section className="flex flex-col gap-2 border-t border-border pt-4">
            <h2 className="text-sm font-medium">Özellikler</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {product.attributes.map((attribute) => (
                <div key={attribute.name} className="contents">
                  <dt className="text-muted-foreground">{attribute.name}</dt>
                  <dd>{attribute.values.join(", ")}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
      </div>
    </div>
  );
}
