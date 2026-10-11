import { Suspense } from "react";
import { isFeatureEnabled } from "@/config/features";
import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader } from "@/components/storefront/site-header";
import { WishlistSync } from "@/components/wishlist/wishlist-sync";
import { getCurrentUser } from "@/modules/auth/session";
import { wishlistService } from "@/modules/wishlist/container";
import { AnalyticsScripts } from "@/shared/analytics/analytics-scripts";
import { CookieBanner } from "@/shared/analytics/cookie-banner";

/** Oturuma göre favori durumunu istemci deposuna taşır. */
async function WishlistBootstrap() {
  if (!isFeatureEnabled("wishlist")) return null;

  const user = await getCurrentUser();
  const ids = user ? await wishlistService.list(user.id) : [];

  return <WishlistSync authenticated={user !== null} ids={ids} />;
}

export default function StorefrontLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
      <SiteFooter />
      <Suspense fallback={null}>
        <WishlistBootstrap />
      </Suspense>
      <CookieBanner />
      <AnalyticsScripts />
    </>
  );
}
