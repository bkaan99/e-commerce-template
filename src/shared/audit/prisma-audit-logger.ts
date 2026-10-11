import type { Prisma } from "../../../generated/prisma/client";
import type { PrismaClient } from "../prisma-client";
import type { AuditEntry, AuditLogger } from "./audit-logger";

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class PrismaAuditLogger implements AuditLogger {
  constructor(private readonly db: PrismaClient) {}

  async log(entry: AuditEntry): Promise<void> {
    await this.db.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: toJson(entry.before),
        after: toJson(entry.after),
        ip: entry.ip ?? null,
      },
    });
  }

  async purgeOlderThan(cutoff: Date): Promise<number> {
    const result = await this.db.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  }
}
