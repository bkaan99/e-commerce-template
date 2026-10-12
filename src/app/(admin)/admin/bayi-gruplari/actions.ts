"use server";

import { runAdminAction, type AdminActionResult } from "@/modules/admin/action";
import { getPriceListService } from "@/modules/admin/container";
import { PERMISSIONS } from "@/shared/permissions";

const PATHS = ["/admin/bayi-gruplari", "/admin/bayiler"];
const perm = PERMISSIONS.PROMOTION_MANAGE;

export async function saveGroupAction(
  id: string | null,
  payload: unknown,
): Promise<AdminActionResult> {
  return runAdminAction(
    perm,
    async (actor) => {
      await getPriceListService().saveGroup(id, payload, actor);
    },
    PATHS,
  );
}

export async function deleteGroupAction(
  id: string,
): Promise<AdminActionResult> {
  return runAdminAction(
    perm,
    (actor) => getPriceListService().deleteGroup(id, actor),
    PATHS,
  );
}

export async function setGroupPriceAction(
  groupId: string,
  variantId: string,
  price: string,
): Promise<AdminActionResult> {
  return runAdminAction(
    perm,
    (actor) =>
      getPriceListService().setGroupPrice(
        groupId,
        variantId,
        price.trim() === "" ? null : price,
        actor,
      ),
    PATHS,
  );
}

export async function setTiersAction(
  groupId: string | null,
  variantId: string,
  tiers: { minQuantity: number; price: string }[],
): Promise<AdminActionResult> {
  return runAdminAction(
    perm,
    (actor) => getPriceListService().setTiers(groupId, variantId, tiers, actor),
    PATHS,
  );
}
