import type { PrismaClient } from "../prisma-client";
import type {
  RateLimitPolicy,
  RateLimitResult,
  RateLimiter,
} from "./rate-limiter";

/** Sabit pencereli sayaç; tek atomik upsert ile çalışır, dış servis gerektirmez. */
export class PostgresRateLimiter implements RateLimiter {
  constructor(
    private readonly db: PrismaClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async consume(
    key: string,
    policy: RateLimitPolicy,
  ): Promise<RateLimitResult> {
    const nowMs = this.now().getTime();
    const windowMs = policy.windowSeconds * 1000;
    const windowStart = new Date(Math.floor(nowMs / windowMs) * windowMs);

    const rows = await this.db.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("key", "windowStart", "count")
      VALUES (${key}, ${windowStart}, 1)
      ON CONFLICT ("key", "windowStart")
      DO UPDATE SET "count" = "RateLimit"."count" + 1
      RETURNING "count"`;

    const count = Number(rows[0]?.count ?? 1);
    const windowEnd = windowStart.getTime() + windowMs;

    return {
      allowed: count <= policy.limit,
      remaining: Math.max(0, policy.limit - count),
      retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - nowMs) / 1000)),
    };
  }

  async purgeExpired(olderThan: Date): Promise<number> {
    const result = await this.db.rateLimit.deleteMany({
      where: { windowStart: { lt: olderThan } },
    });
    return result.count;
  }
}
