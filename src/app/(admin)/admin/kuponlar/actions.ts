"use server";

import { runAdminAction, type AdminActionResult } from "@/modules/admin/action";
import { getPromotionService } from "@/modules/admin/container";
import { PERMISSIONS } from "@/shared/permissions";

const PATHS = ["/admin/kuponlar"];
const perm = PERMISSIONS.PROMOTION_MANAGE;

export async function saveCouponAction(
  id: string | null,
  payload: unknown,
): Promise<AdminActionResult> {
  return runAdminAction(
    perm,
    (actor) => getPromotionService().saveCoupon(id, payload, actor),
    PATHS,
  );
}

export async function deleteCouponAction(
  id: string,
): Promise<AdminActionResult> {
  return runAdminAction(
    perm,
    (actor) => getPromotionService().deleteCoupon(id, actor),
    PATHS,
  );
}

export async function saveCampaignAction(
  id: string | null,
  payload: unknown,
): Promise<AdminActionResult> {
  return runAdminAction(
    perm,
    (actor) => getPromotionService().saveCampaign(id, payload, actor),
    PATHS,
  );
}

export async function deleteCampaignAction(
  id: string,
): Promise<AdminActionResult> {
  return runAdminAction(
    perm,
    (actor) => getPromotionService().deleteCampaign(id, actor),
    PATHS,
  );
}
