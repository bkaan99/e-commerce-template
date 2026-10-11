import "dotenv/config";
import { createPrismaClient } from "../src/shared/prisma-client";
import { createAdminUser } from "./lib/create-admin-user";

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

  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) throw new Error("DATABASE_URL tanımlı değil");

  const db = createPrismaClient(connectionString);
  try {
    const created = await createAdminUser(db, {
      email,
      password,
      firstName,
      lastName,
    });
    console.log(`Yönetici hazır: ${created}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
