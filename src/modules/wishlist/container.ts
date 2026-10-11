import { getDb } from "@/shared/db";
import { PrismaWishlistRepository } from "./wishlist.repository";
import { WishlistService } from "./wishlist.service";

export const wishlistService = new WishlistService(
  new PrismaWishlistRepository(getDb),
);
