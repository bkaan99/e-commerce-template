"use server";

import { runAdminAction, type AdminActionResult } from "@/modules/admin/action";
import { getContentService } from "@/modules/content/container";
import { PERMISSIONS } from "@/shared/permissions";

const PATHS = ["/admin/icerik", "/"];
const perm = PERMISSIONS.CONTENT_MANAGE;

export async function saveBannerAction(
  id: string | null,
  payload: unknown,
): Promise<AdminActionResult> {
  return runAdminAction(
    perm,
    (actor) => getContentService().saveBanner(id, payload, actor),
    PATHS,
  );
}

export async function deleteBannerAction(
  id: string,
): Promise<AdminActionResult> {
  return runAdminAction(
    perm,
    (actor) => getContentService().deleteBanner(id, actor),
    PATHS,
  );
}

export async function savePageAction(
  id: string | null,
  payload: unknown,
): Promise<AdminActionResult> {
  return runAdminAction(
    perm,
    async (actor) => {
      await getContentService().savePage(id, payload, actor);
    },
    PATHS,
  );
}

export async function deletePageAction(id: string): Promise<AdminActionResult> {
  return runAdminAction(
    perm,
    (actor) => getContentService().deletePage(id, actor),
    PATHS,
  );
}

export async function saveMenuAction(
  payload: unknown,
): Promise<AdminActionResult> {
  return runAdminAction(
    perm,
    (actor) => getContentService().saveMenu(payload, actor),
    PATHS,
  );
}
