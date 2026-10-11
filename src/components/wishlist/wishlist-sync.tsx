"use client";

import { useEffect } from "react";
import { initWishlist } from "./wishlist-store";

/** Sunucudaki favori durumunu istemci deposuna aktarır. */
export function WishlistSync({
  authenticated,
  ids,
}: {
  authenticated: boolean;
  ids: string[];
}) {
  const key = ids.join(",");

  useEffect(() => {
    void initWishlist(authenticated, key ? key.split(",") : []);
  }, [authenticated, key]);

  return null;
}
