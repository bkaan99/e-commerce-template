"use server";

import { runAdminAction, type AdminActionResult } from "@/modules/admin/action";
import { getStaffService } from "@/modules/admin/container";
import { PERMISSIONS } from "@/shared/permissions";

const PATHS = ["/admin/personel", "/admin/roller"];
const perm = PERMISSIONS.ROLE_MANAGE;

export async function inviteStaffAction(
  payload: unknown,
): Promise<AdminActionResult> {
  return runAdminAction(
    perm,
    async (actor, user) => {
      await getStaffService().invite(payload, {
        ...actor,
        permissions: user.permissions,
      });
    },
    PATHS,
  );
}

export async function setStaffRolesAction(
  userId: string,
  roleIds: string[],
): Promise<AdminActionResult> {
  return runAdminAction(
    perm,
    (actor, user) =>
      getStaffService().setRoles(userId, roleIds, {
        ...actor,
        permissions: user.permissions,
      }),
    PATHS,
  );
}

export async function setStaffActiveAction(
  userId: string,
  active: boolean,
): Promise<AdminActionResult> {
  return runAdminAction(
    perm,
    (actor, user) =>
      getStaffService().setActive(userId, active, {
        ...actor,
        permissions: user.permissions,
      }),
    PATHS,
  );
}

export async function resendInviteAction(
  userId: string,
): Promise<AdminActionResult> {
  return runAdminAction(
    perm,
    (actor, user) =>
      getStaffService().resendInvite(userId, {
        ...actor,
        permissions: user.permissions,
      }),
    PATHS,
  );
}
