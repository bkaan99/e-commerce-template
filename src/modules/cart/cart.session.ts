import "server-only";
import { cookies } from "next/headers";
import { getCurrentUser } from "../auth/session";
import { getRequestPricing } from "../b2b/pricing-identity";
import { cartService } from "./container";
import type { CartIdentity, CartMutationResult, CartView } from "./cart.types";

const CART_COOKIE = "cart_token";
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

/** İstekteki sepet sahibini (üye veya misafir çerezi) belirler. */
export async function getCartIdentity(): Promise<CartIdentity> {
  const [user, cookieStore, pricing] = await Promise.all([
    getCurrentUser(),
    cookies(),
    getRequestPricing(),
  ]);

  return {
    userId: user?.id ?? null,
    sessionToken: cookieStore.get(CART_COOKIE)?.value ?? null,
    customerGroupId: pricing.customerGroupId,
  };
}

/** Geçerli isteğin sepetini döndürür (okuma). */
export async function getCurrentCart(): Promise<CartView> {
  const result = await cartService.getCart(await getCartIdentity());
  return result.cart;
}

/** Yalnızca Server Action / Route Handler içinde çağrılmalıdır. */
export async function persistCartCookie(
  result: Pick<CartMutationResult, "sessionToken" | "clearSessionToken">,
): Promise<void> {
  const cookieStore = await cookies();

  if (result.sessionToken) {
    cookieStore.set(CART_COOKIE, result.sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: THIRTY_DAYS_SECONDS,
    });
  } else if (result.clearSessionToken) {
    cookieStore.delete(CART_COOKIE);
  }
}
