import Link from "next/link";
import { getCurrentCart } from "@/modules/cart/cart.session";

export async function CartBadge() {
  const cart = await getCurrentCart();

  return (
    <Link
      href="/sepet"
      className="relative inline-flex items-center gap-1 text-sm"
      aria-label={`Sepet, ${cart.itemCount} ürün`}
    >
      Sepet
      {cart.itemCount > 0 ? (
        <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
          {cart.itemCount}
        </span>
      ) : null}
    </Link>
  );
}
