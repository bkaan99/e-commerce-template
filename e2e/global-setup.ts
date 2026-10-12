import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

export const E2E_PREFIX = "e2e-";

function runTask(task: "setup" | "cleanup"): void {
  execFileSync("npx", ["tsx", "e2e/support/db-tasks.ts", task], {
    stdio: "inherit",
    env: process.env,
  });
}

/** Test personeli oluşturur; geçici kimlik bilgileri yalnızca bu süreçte tutulur. */
export default function globalSetup(): () => void {
  const suffix = randomBytes(4).toString("hex");
  process.env["E2E_ADMIN_EMAIL"] = `${E2E_PREFIX}admin-${suffix}@example.test`;
  process.env["E2E_ADMIN_PASSWORD"] = `E2e-${randomBytes(9).toString("hex")}1`;

  runTask("setup");
  return () => runTask("cleanup");
}
