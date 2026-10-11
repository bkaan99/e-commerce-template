import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, type PrismaClient } from "../prisma-client";
import { PrismaAuditLogger } from "./prisma-audit-logger";

describe("PrismaAuditLogger", () => {
  let db: PrismaClient;
  let logger: PrismaAuditLogger;

  beforeAll(() => {
    db = createPrismaClient(process.env["TEST_DATABASE_URL"]!);
    logger = new PrismaAuditLogger(db);
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("eski ve yeni değerlerle kayıt yazar", async () => {
    const entityId = randomUUID();

    await logger.log({
      actorId: null,
      action: "product.price.update",
      entityType: "Product",
      entityId,
      before: { price: "100.00" },
      after: { price: "120.00" },
      ip: "127.0.0.1",
    });

    const row = await db.auditLog.findFirstOrThrow({ where: { entityId } });
    expect(row.action).toBe("product.price.update");
    expect(row.before).toEqual({ price: "100.00" });
    expect(row.after).toEqual({ price: "120.00" });
    expect(row.ip).toBe("127.0.0.1");
  });

  it("saklama süresi dolan kayıtları siler, yenileri korur", async () => {
    const oldId = randomUUID();
    const freshId = randomUUID();

    await db.auditLog.create({
      data: {
        action: "test.old",
        entityType: "Test",
        entityId: oldId,
        createdAt: new Date("2020-01-01T00:00:00Z"),
      },
    });
    await logger.log({
      actorId: null,
      action: "test.fresh",
      entityType: "Test",
      entityId: freshId,
    });

    await logger.purgeOlderThan(new Date("2021-01-01T00:00:00Z"));

    expect(await db.auditLog.count({ where: { entityId: oldId } })).toBe(0);
    expect(await db.auditLog.count({ where: { entityId: freshId } })).toBe(1);
  });
});
