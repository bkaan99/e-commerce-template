"use server";

import { runAdminAction, type AdminActionResult } from "@/modules/admin/action";
import { getDealerService } from "@/modules/b2b/container";
import { PERMISSIONS } from "@/shared/permissions";

const PATHS = ["/admin/bayiler", "/admin"];
const perm = PERMISSIONS.B2B_APPROVE;

export async function approveDealerAction(
  userId: string,
  payload: unknown,
): Promise<AdminActionResult> {
  return runAdminAction(
    perm,
    (actor) => getDealerService().approve(userId, payload, actor),
    PATHS,
  );
}

export async function updateDealerTermsAction(
  userId: string,
  payload: unknown,
): Promise<AdminActionResult> {
  return runAdminAction(
    perm,
    (actor) => getDealerService().updateTerms(userId, payload, actor),
    PATHS,
  );
}

export async function rejectDealerAction(
  userId: string,
  note: string,
): Promise<AdminActionResult> {
  return runAdminAction(
    perm,
    (actor) => getDealerService().reject(userId, note || null, actor),
    PATHS,
  );
}
