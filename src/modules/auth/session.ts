import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import { ForbiddenError } from "@/shared/errors";
import type { Permission } from "@/shared/permissions";
import type { AuthUserRecord } from "./auth.repository";
import { authUsers } from "./container";
import { hasPermission } from "./authorization";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  type: AuthUserRecord["type"];
  permissions: string[];
}

/** Oturumdaki kullanıcıyı ve güncel yetkilerini döndürür; oturum yoksa null. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Auth.js rastgele değer üretir; oturum okumak istek anında yapılmalıdır.
  await connection();

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await authUsers.findById(userId);
  if (!user || !user.isActive || user.anonymized) return null;

  return {
    id: user.id,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`.trim(),
    type: user.type,
    permissions: user.permissions,
  };
});

/** Giriş yapmış kullanıcıyı zorunlu kılar; yoksa giriş sayfasına yönlendirir. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  return user;
}

/** Personel girişi ve belirli bir yetkiyi zorunlu kılar. */
export async function requirePermission(
  permission: Permission,
): Promise<CurrentUser> {
  const user = await requireUser();

  if (user.type !== "STAFF" || !hasPermission(user.permissions, permission)) {
    throw new ForbiddenError();
  }

  return user;
}

/** Personel girişini zorunlu kılar; müşteri hesabı admin alanına giremez. */
export async function requireStaff(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.type !== "STAFF") redirect("/");
  return user;
}
