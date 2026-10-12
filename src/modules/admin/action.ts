import "server-only";
import { revalidatePath } from "next/cache";
import { isAppError } from "@/shared/errors";
import { reportError } from "@/shared/error-reporter";
import { getClientIp } from "@/shared/rate-limit";
import type { Permission } from "@/shared/permissions";
import { invalidateStorefrontCaches } from "@/shared/cache/registry";
import { requirePermission, type CurrentUser } from "../auth/session";
import type { Actor } from "./orders/admin-order.service";

export interface AdminActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Admin Server Action'larının ortak iskeleti: yetki kontrolü, istemci IP'si,
 * hata dönüşümü ve sayfa önbelleğini yenileme tek yerde toplanır.
 */
export async function runAdminAction(
  permission: Permission,
  handler: (actor: Actor, user: CurrentUser) => Promise<void>,
  revalidate: string[] = [],
): Promise<AdminActionResult> {
  try {
    const user = await requirePermission(permission);
    await handler({ userId: user.id, ip: await getClientIp() }, user);
    invalidateStorefrontCaches();
    for (const path of revalidate) revalidatePath(path);
    return { ok: true };
  } catch (error) {
    if (isAppError(error)) return { ok: false, error: error.message };
    reportError(error, { action: "admin" });
    return { ok: false, error: "İşlem tamamlanamadı, lütfen tekrar deneyin." };
  }
}
