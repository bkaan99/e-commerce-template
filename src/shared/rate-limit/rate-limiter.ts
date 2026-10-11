export interface RateLimitPolicy {
  /** Pencere başına izin verilen istek sayısı */
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(key: string, policy: RateLimitPolicy): Promise<RateLimitResult>;
  /** Süresi geçmiş pencereleri siler. */
  purgeExpired(olderThan: Date): Promise<number>;
}

/** Uç bazında hazır politikalar. */
export const RATE_LIMIT_POLICIES = {
  login: { limit: 10, windowSeconds: 15 * 60 },
  register: { limit: 5, windowSeconds: 60 * 60 },
  passwordReset: { limit: 5, windowSeconds: 60 * 60 },
  couponAttempt: { limit: 20, windowSeconds: 10 * 60 },
  orderLookup: { limit: 10, windowSeconds: 10 * 60 },
  stockAlert: { limit: 10, windowSeconds: 60 * 60 },
  checkout: { limit: 20, windowSeconds: 60 * 60 },
} as const satisfies Record<string, RateLimitPolicy>;
