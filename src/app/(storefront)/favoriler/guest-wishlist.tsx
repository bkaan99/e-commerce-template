"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ProductGrid } from "@/components/storefront/product-grid";
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
} from "@/components/wishlist/wishlist-store";
import type { ProductCard } from "@/modules/catalog/catalog.types";
import { getWishlistCardsAction } from "./actions";

/** Misafir favorileri tarayıcıda tutulur; ürün kartları sunucudan çekilir. */
export function GuestWishlist() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [cards, setCards] = useState<ProductCard[] | null>(null);
  const key = [...state.ids].sort().join(",");

  useEffect(() => {
    let cancelled = false;
    const ids = key ? key.split(",") : [];

    if (ids.length === 0) return;

    void getWishlistCardsAction(ids).then((result) => {
      if (!cancelled) setCards(result);
    });

    return () => {
      cancelled = true;
    };
  }, [key]);

  if (key !== "" && cards === null) {
    return <p className="text-muted-foreground">Yükleniyor...</p>;
  }

  if (key === "" || cards === null || cards.length === 0) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        Henüz favori ürününüz yok.
      </p>
    );
  }

  return <ProductGrid products={cards} />;
}
