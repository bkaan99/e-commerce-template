import "dotenv/config";
import { createAdminUser } from "../../scripts/lib/create-admin-user";
import { createPrismaClient } from "../../src/shared/prisma-client";

/**
 * Playwright'ın CJS yükleyicisi Prisma istemcisini (ESM) yükleyemediğinden
 * veritabanı işleri tsx ile ayrı bir süreçte çalışır.
 * Kullanım: tsx e2e/support/db-tasks.ts <setup|cleanup>
 */
const PREFIX = "e2e-";

async function main(): Promise<void> {
  const task = process.argv[2];
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) throw new Error("DATABASE_URL tanımlı değil");

  const db = createPrismaClient(connectionString);
  try {
    if (task === "setup") {
      const email = process.env["E2E_ADMIN_EMAIL"];
      const password = process.env["E2E_ADMIN_PASSWORD"];
      if (!email || !password) throw new Error("Test yöneticisi tanımlı değil");
      await createAdminUser(db, {
        email,
        password,
        firstName: "E2E",
        lastName: "Yönetici",
      });
    } else if (task === "cleanup") {
      try {
        await db.order.deleteMany({
          where: { guestEmail: { startsWith: PREFIX } },
        });
        await db.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
      } catch {
        // Bağımlı kayıtlar silmeyi engellerse hesapları pasifleştir.
        await db.user.updateMany({
          where: { email: { startsWith: PREFIX } },
          data: { isActive: false },
        });
      }
    } else {
      throw new Error(`Bilinmeyen görev: ${task}`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
