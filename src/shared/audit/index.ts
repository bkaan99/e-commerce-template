import "server-only";
import { getDb } from "../db";
import type { AuditLogger } from "./audit-logger";
import { PrismaAuditLogger } from "./prisma-audit-logger";

export type { AuditEntry, AuditLogger } from "./audit-logger";

let logger: AuditLogger | undefined;

export function getAuditLogger(): AuditLogger {
  logger ??= new PrismaAuditLogger(getDb());
  return logger;
}
