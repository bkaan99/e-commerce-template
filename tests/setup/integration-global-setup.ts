import "dotenv/config";
import { execSync } from "node:child_process";
import { Client } from "pg";

/**
 * Entegrasyon testleri için ayrı bir veritabanı hazırlar (yoksa oluşturur) ve
 * migration'ları uygular. Geliştirme veritabanına dokunmaz.
 */
export default async function setup(): Promise<void> {
  const baseUrl =
    process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];
  if (!baseUrl) {
    throw new Error("TEST_DATABASE_URL veya DATABASE_URL tanımlı olmalı");
  }

  const url = new URL(baseUrl);
  const baseName = url.pathname.replace(/^\//, "");
  const testName = baseName.endsWith("_test") ? baseName : `${baseName}_test`;

  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const exists = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [testName],
    );
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${testName}"`);
    }
  } finally {
    await admin.end();
  }

  url.pathname = `/${testName}`;
  const testUrl = url.toString();

  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: testUrl },
  });

  process.env["TEST_DATABASE_URL"] = testUrl;
}
