import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, type PrismaClient } from "../prisma-client";
import { PostgresRateLimiter } from "./postgres-rate-limiter";

describe("PostgresRateLimiter", () => {
  let db: PrismaClient;

  beforeAll(() => {
    db = createPrismaClient(process.env["TEST_DATABASE_URL"]!);
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("limiti aşan istekleri reddeder", async () => {
    const limiter = new PostgresRateLimiter(db);
    const key = `test:${randomUUID()}`;
    const policy = { limit: 3, windowSeconds: 60 };

    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push((await limiter.consume(key, policy)).allowed);
    }

    expect(results).toEqual([true, true, true, false, false]);
  });

  it("farklı anahtarları ayrı sayar", async () => {
    const limiter = new PostgresRateLimiter(db);
    const policy = { limit: 1, windowSeconds: 60 };

    const a = await limiter.consume(`test:${randomUUID()}`, policy);
    const b = await limiter.consume(`test:${randomUUID()}`, policy);

    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });

  it("yeni pencerede sayaç yeniden başlar", async () => {
    let current = new Date("2026-01-01T00:00:00Z");
    const limiter = new PostgresRateLimiter(db, () => current);
    const key = `test:${randomUUID()}`;
    const policy = { limit: 1, windowSeconds: 60 };

    expect((await limiter.consume(key, policy)).allowed).toBe(true);
    expect((await limiter.consume(key, policy)).allowed).toBe(false);

    current = new Date(current.getTime() + 61_000);
    expect((await limiter.consume(key, policy)).allowed).toBe(true);
  });

  it("eşzamanlı isteklerde sayaç tutarlıdır", async () => {
    const limiter = new PostgresRateLimiter(db);
    const key = `test:${randomUUID()}`;
    const policy = { limit: 5, windowSeconds: 60 };

    const results = await Promise.all(
      Array.from({ length: 10 }, () => limiter.consume(key, policy)),
    );

    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });

  it("süresi geçen pencereleri siler", async () => {
    const limiter = new PostgresRateLimiter(
      db,
      () => new Date("2020-01-01T00:00:00Z"),
    );
    await limiter.consume(`test:${randomUUID()}`, {
      limit: 1,
      windowSeconds: 60,
    });

    const removed = await limiter.purgeExpired(
      new Date("2021-01-01T00:00:00Z"),
    );
    expect(removed).toBeGreaterThanOrEqual(1);
  });
});
