import { connection } from "next/server";
import { getDb } from "@/shared/db";
import { reportError } from "@/shared/error-reporter";
import { getJobQueue } from "@/shared/queue";

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

async function checkQueue(): Promise<CheckResult> {
  return (await getJobQueue().healthCheck()) ? "ok" : "fail";
}

/** Readiness: trafik almaya hazır mı? Bağımlılıkları kontrol eder. */
export async function GET() {
  await connection();

  const [database, queue] = await Promise.all([checkDatabase(), checkQueue()]);
  const checks = { database, queue };
  const ready = Object.values(checks).every((result) => result === "ok");

  return Response.json(
    { status: ready ? "ready" : "unavailable", checks },
    { status: ready ? 200 : 503 },
  );
}
