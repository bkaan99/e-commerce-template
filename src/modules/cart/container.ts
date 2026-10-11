import { getDb } from "@/shared/db";
import { PrismaCartRepository } from "./cart.repository";
import { CartService } from "./cart.service";

export const cartService = new CartService(new PrismaCartRepository(getDb));
