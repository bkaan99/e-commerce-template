"use server";

import { runAdminAction, type AdminActionResult } from "@/modules/admin/action";
import { getTaxonomyService } from "@/modules/admin/container";
import { PERMISSIONS } from "@/shared/permissions";

const PATHS = ["/admin/kategoriler", "/admin/urunler", "/"];

export async function saveCategoryAction(
  id: string | null,
  payload: unknown,
): Promise<AdminActionResult> {
  return runAdminAction(
    PERMISSIONS.CATALOG_MANAGE,
    async (actor) => {
      await getTaxonomyService().saveCategory(id, payload, actor);
    },
    PATHS,
  );
}

export async function deleteCategoryAction(
  id: string,
): Promise<AdminActionResult> {
  return runAdminAction(
    PERMISSIONS.CATALOG_MANAGE,
    (actor) => getTaxonomyService().deleteCategory(id, actor),
    PATHS,
  );
}
