import "server-only";
import { requireStaff, type CurrentUser } from "../auth/session";
import { hasPermission } from "../auth/authorization";
import type { Permission } from "@/shared/permissions";

/**
 * Admin sayfaları için yetki kontrolü. Personel değilse girişe/ana sayfaya
 * yönlendirir; yetki yoksa `null` döner ve sayfa "erişim yok" gösterir.
 */
export async function adminPage(
  permission?: Permission,
): Promise<CurrentUser | null> {
  const user = await requireStaff();
  if (permission && !hasPermission(user.permissions, permission)) return null;
  return user;
}

/** Server Action'larda kullanılır; yetki yoksa ForbiddenError fırlatır. */
export { requirePermission } from "../auth/session";
