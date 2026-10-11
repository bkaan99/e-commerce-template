import "server-only";
import { headers } from "next/headers";
import { getDb } from "../db";
import { RateLimitError } from "../errors";
import { PostgresRateLimiter } from "./postgres-rate-limiter";
import type { RateLimitPolicy, RateLimiter } from "./rate-limiter";

export * from "./rate-limiter";

let limiter: RateLimiter | undefined;

export function getRateLimiter(): RateLimiter {
  limiter ??= new PostgresRateLimiter(getDb());
  return limiter;
}

/** İsteği yapan istemcinin IP adresi (reverse proxy başlıklarından). */
export async function getClientIp(): Promise<string> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}

/** Limit aşıldıysa RateLimitError fırlatır. */
export async function enforceRateLimit(
  scope: string,
  identifier: string,
  policy: RateLimitPolicy,
): Promise<void> {
  const result = await getRateLimiter().consume(
    `${scope}:${identifier}`,
    policy,
  );
  if (!result.allowed) {
    throw new RateLimitError();
  }
}
