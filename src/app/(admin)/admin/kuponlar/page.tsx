import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { PageHeader } from "@/components/admin/page-header";
import {
  getProductAdminService,
  getPromotionService,
} from "@/modules/admin/container";
import { adminPage } from "@/modules/admin/guard";
import { PERMISSIONS } from "@/shared/permissions";
import { PromotionManager, type CampaignRow } from "./promotion-manager";

export const metadata: Metadata = { title: "Kupon ve kampanyalar" };

function toCampaignRow(campaign: {
  id: string;
  name: string;
  ruleType: string;
  config: unknown;
  priority: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}): CampaignRow {
  const config = (campaign.config ?? {}) as {
    type?: "PERCENT" | "FIXED";
    value?: number;
    categoryIds?: string[];
    minSubtotal?: number;
  };

  return {
    id: campaign.id,
    name: campaign.name,
    ruleType: campaign.ruleType,
    type: config.type ?? "PERCENT",
    value: config.value ?? 0,
    categoryIds: config.categoryIds ?? [],
    minSubtotal: config.minSubtotal ?? null,
    priority: campaign.priority,
    startsAt: campaign.startsAt?.toISOString() ?? null,
    endsAt: campaign.endsAt?.toISOString() ?? null,
    isActive: campaign.isActive,
  };
}

async function PromotionsContent() {
  const user = await adminPage(PERMISSIONS.PROMOTION_MANAGE);
  if (!user) return <AccessDenied />;

  const promotions = getPromotionService();
  const [coupons, campaigns, references] = await Promise.all([
    promotions.listCoupons(),
    promotions.listCampaigns(),
    getProductAdminService().references(),
  ]);

  return (
    <PromotionManager
      coupons={coupons.map((coupon) => ({
        ...coupon,
        startsAt: coupon.startsAt?.toISOString() ?? null,
        endsAt: coupon.endsAt?.toISOString() ?? null,
      }))}
      campaigns={campaigns.map(toCampaignRow)}
      categories={references.categories}
    />
  );
}

export default function AdminPromotionsPage() {
  return (
    <>
      <PageHeader
        title="Kupon ve kampanyalar"
        description="Kuponlar müşteri tarafından girilir; kampanyalar koşul sağlanınca otomatik uygulanır."
      />
      <Suspense
        fallback={<p className="text-muted-foreground">Yükleniyor...</p>}
      >
        <PromotionsContent />
      </Suspense>
    </>
  );
}
