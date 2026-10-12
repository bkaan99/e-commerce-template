import "server-only";
import { cache } from "react";
import { features } from "@/config/features";
import { siteConfig } from "@/config/site.config";
import { getDb } from "@/shared/db";
import type { PricingIdentity } from "../catalog/catalog.service";
import { getCurrentUser } from "../auth/session";
import { PrismaDealerRepository } from "./dealer.repository";
import type { DealerProfile } from "./dealer.types";

export interface RequestPricing extends PricingIdentity {
  dealer: DealerProfile | null;
  /** Onaylı bayi mi? (B2B özelliği açıkken) */
  dealerApproved: boolean;
  isStaff: boolean;
}

/**
 * İstek sahibinin fiyat kimliği: bayi grubu ve fiyatların görünürlüğü.
 * - retail: herkes perakende fiyatı görür, grup fiyatı uygulanmaz.
 * - hybrid: onaylı bayi kendi grubunun fiyatını görür.
 * - b2b: fiyatlar yalnızca onaylı bayilere (ve personele) görünür.
 */
export const getRequestPricing = cache(async (): Promise<RequestPricing> => {
  const user = await getCurrentUser();
  const isStaff = user?.type === "STAFF";

  let dealer: DealerProfile | null = null;
  if (user && features.b2b) {
    dealer = await new PrismaDealerRepository(getDb).findProfile(user.id);
  }

  const dealerApproved = dealer?.status === "APPROVED";
  const pricesVisible =
    siteConfig.salesMode !== "b2b" || dealerApproved || isStaff;

  return {
    dealer,
    dealerApproved,
    isStaff,
    customerGroupId: dealerApproved ? dealer!.groupId : null,
    pricesVisible,
  };
});
