"use server";

import { runAdminAction, type AdminActionResult } from "@/modules/admin/action";
import { getStaffService } from "@/modules/admin/container";
import { PERMISSIONS } from "@/shared/permissions";

const PATHS = ["/admin/roller", "/admin/personel"];

export async function saveRoleAction(
  id: string | null,
  payload: unknown,
): Promise<AdminActionResult> {
  return runAdminAction(
    PERMISSIONS.ROLE_MANAGE,
    async (actor, user) => {
      await getStaffService().saveRole(id, payload, {
        ...actor,
        permissions: user.permissions,
      });
    },
    PATHS,
  );
}

export async function deleteRoleAction(id: string): Promise<AdminActionResult> {
  return runAdminAction(
    PERMISSIONS.ROLE_MANAGE,
    (actor, user) =>
      getStaffService().deleteRole(id, {
        ...actor,
        permissions: user.permissions,
      }),
    PATHS,
  );
}
