"use client";

import { useSyncExternalStore } from "react";
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  toggleWishlist,
} from "./wishlist-store";

export function WishlistButton({
  productId,
  className = "",
}: {
  productId: string;
  className?: string;
}) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const favorite = state.ids.has(productId);

  return (
    <button
      type="button"
      aria-pressed={favorite}
      aria-label={favorite ? "Favorilerden çıkar" : "Favorilere ekle"}
      onClick={() => void toggleWishlist(productId)}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill={favorite ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
    </button>
  );
}
