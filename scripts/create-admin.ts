import "dotenv/config";
import { Argon2PasswordHasher } from "../src/modules/auth/password-hasher";
import { createPrismaClient } from "../src/shared/prisma-client";

/**
 * Kullanım: npx tsx scripts/create-admin.ts <e-posta> <parola> [ad] [soyad]
 * Aynı e-posta varsa parola ve rol güncellenir.
 */
async function main(): Promise<void> {
  const [email, password, firstName = "Admin", lastName = "Kullanıcı"] =
    process.argv.slice(2);

  if (!email || !password) {
    throw new Error("Kullanım: create-admin <e-posta> <parola> [ad] [soyad]");
  }
  if (password.length < 10) {
    throw new Error("Parola en az 10 karakter olmalı");
  }

  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) throw new Error("DATABASE_URL tanımlı değil");

  const db = createPrismaClient(connectionString);
  try {
    const role = await db.role.findUnique({ where: { name: "admin" } });
    if (!role) {
      throw new Error("admin rolü yok. Önce `npm run db:seed` çalıştırın.");
    }

    const passwordHash = await new Argon2PasswordHasher().hash(password);
    const normalizedEmail = email.trim().toLowerCase();

    const user = await db.user.upsert({
      where: { email: normalizedEmail },
      update: { passwordHash, type: "STAFF", isActive: true },
      create: {
        email: normalizedEmail,
        passwordHash,
        firstName,
        lastName,
        type: "STAFF",
        emailVerifiedAt: new Date(),
      },
    });

    await db.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });

    console.log(`Yönetici hazır: ${normalizedEmail}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
