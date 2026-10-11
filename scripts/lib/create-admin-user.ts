import { Argon2PasswordHasher } from "../../src/modules/auth/password-hasher";
import type { PrismaClient } from "../../src/shared/prisma-client";

export const MIN_ADMIN_PASSWORD_LENGTH = 10;

export interface AdminInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/** Yönetici kullanıcıyı oluşturur veya parolasını ve rolünü günceller. */
export async function createAdminUser(
  db: PrismaClient,
  input: AdminInput,
): Promise<string> {
  if (input.password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(
      `Parola en az ${MIN_ADMIN_PASSWORD_LENGTH} karakter olmalı`,
    );
  }

  const role = await db.role.findUnique({ where: { name: "admin" } });
  if (!role) {
    throw new Error("admin rolü yok. Önce `npm run db:seed` çalıştırın.");
  }

  const passwordHash = await new Argon2PasswordHasher().hash(input.password);
  const email = input.email.trim().toLowerCase();

  const user = await db.user.upsert({
    where: { email },
    update: { passwordHash, type: "STAFF", isActive: true },
    create: {
      email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      type: "STAFF",
      emailVerifiedAt: new Date(),
    },
  });

  await db.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  return email;
}
