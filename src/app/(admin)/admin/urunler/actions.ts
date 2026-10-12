"use server";

import { getProductAdminService } from "@/modules/admin/container";
import {
  ProductValidationError,
  type FieldErrors,
} from "@/modules/admin/catalog/product-admin.service";
import { isAppError } from "@/shared/errors";
import { reportError } from "@/shared/error-reporter";
import { PERMISSIONS } from "@/shared/permissions";
import { requirePermission } from "@/modules/auth/session";
import { getClientIp } from "@/shared/rate-limit";
import { revalidatePath } from "next/cache";
import { invalidateStorefrontCaches } from "@/shared/cache/registry";

export interface SaveProductResult {
  ok: boolean;
  id?: string;
  error?: string;
  fieldErrors?: FieldErrors;
}

/** Ürünü oluşturur (id yok) veya günceller. */
export async function saveProductAction(
  id: string | null,
  payload: unknown,
): Promise<SaveProductResult> {
  try {
    const user = await requirePermission(PERMISSIONS.PRODUCT_WRITE);
    const actor = { userId: user.id, ip: await getClientIp() };
    const service = getProductAdminService();

    let savedId = id;
    if (id) await service.update(id, payload, actor);
    else savedId = await service.create(payload, actor);

    invalidateStorefrontCaches();
    revalidatePath("/admin/urunler");
    revalidatePath("/", "layout");
    return { ok: true, id: savedId ?? undefined };
  } catch (error) {
    if (error instanceof ProductValidationError) {
      return {
        ok: false,
        error: error.message,
        fieldErrors: error.fieldErrors,
      };
    }
    if (isAppError(error)) return { ok: false, error: error.message };
    reportError(error, { action: "saveProduct" });
    return { ok: false, error: "Ürün kaydedilemedi, lütfen tekrar deneyin." };
  }
}
