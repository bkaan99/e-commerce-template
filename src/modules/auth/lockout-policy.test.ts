import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCKOUT_POLICY,
  isLocked,
  nextStateAfterFailure,
} from "./lockout-policy";

const now = new Date("2026-01-01T12:00:00Z");

describe("lockout policy", () => {
  it("limite kadar yalnızca sayacı artırır", () => {
    const state = nextStateAfterFailure(
      { failedLoginCount: 2, lockedUntil: null },
      now,
    );
    expect(state).toEqual({ failedLoginCount: 3, lockedUntil: null });
  });

  it("limite ulaşınca kilitler ve sayacı sıfırlar", () => {
    const state = nextStateAfterFailure(
      {
        failedLoginCount: DEFAULT_LOCKOUT_POLICY.maxFailedAttempts - 1,
        lockedUntil: null,
      },
      now,
    );
    expect(state.failedLoginCount).toBe(0);
    expect(state.lockedUntil?.getTime()).toBe(
      now.getTime() + DEFAULT_LOCKOUT_POLICY.lockMinutes * 60_000,
    );
  });

  it("isLocked kilit süresi dolunca false döner", () => {
    const lockedUntil = new Date(now.getTime() + 1000);
    expect(isLocked({ lockedUntil }, now)).toBe(true);
    expect(isLocked({ lockedUntil }, new Date(now.getTime() + 2000))).toBe(
      false,
    );
    expect(isLocked({ lockedUntil: null }, now)).toBe(false);
  });
});
