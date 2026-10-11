"use server";

import { runAdminAction, type AdminActionResult } from "@/modules/admin/action";
import { getReturnService } from "@/modules/returns/container";
import { PERMISSIONS } from "@/shared/permissions";

export async function approveReturnAction(
  requestId: string,
  restock: boolean,
): Promise<AdminActionResult> {
  return runAdminAction(
    PERMISSIONS.RETURN_MANAGE,
    (actor) => getReturnService().approve(requestId, { restock }, actor),
    ["/admin/iadeler", "/admin/siparisler", "/admin"],
  );
}

export async function rejectReturnAction(
  requestId: string,
  adminNote: string,
): Promise<AdminActionResult> {
  return runAdminAction(
    PERMISSIONS.RETURN_MANAGE,
    (actor) => getReturnService().reject(requestId, adminNote || null, actor),
    ["/admin/iadeler", "/admin"],
  );
}
