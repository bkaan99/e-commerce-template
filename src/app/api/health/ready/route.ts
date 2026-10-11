import { connection } from "next/server";
import { getDb } from "@/shared/db";
import { reportError } from "@/shared/error-reporter";

type CheckResult = "ok" | "fail";

async function checkDatabase(): Promise<CheckResult> {
  try {
    await getDb().$queryRaw`SELECT 1`;
    return "ok";
  } catch (error) {
    reportError(error, { check: "database" });
    return "fail";
  }
}

/** Readiness: trafik almaya hazır mı? Bağımlılıkları kontrol eder. */
export async function GET() {
  await connection();

  const checks = { database: await checkDatabase() };
  const ready = Object.values(checks).every((result) => result === "ok");

  return Response.json(
    { status: ready ? "ready" : "unavailable", checks },
    { status: ready ? 200 : 503 },
  );
}
