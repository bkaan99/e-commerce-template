export interface LockoutPolicy {
  maxFailedAttempts: number;
  lockMinutes: number;
}

export const DEFAULT_LOCKOUT_POLICY: LockoutPolicy = {
  maxFailedAttempts: 5,
  lockMinutes: 15,
};

export interface LoginFailureState {
  failedLoginCount: number;
  lockedUntil: Date | null;
}

export function isLocked(
  state: Pick<LoginFailureState, "lockedUntil">,
  now: Date,
): boolean {
  return state.lockedUntil !== null && state.lockedUntil > now;
}

/** Hatalı bir girişten sonra yeni sayaç ve kilit durumunu hesaplar. */
export function nextStateAfterFailure(
  current: LoginFailureState,
  now: Date,
  policy: LockoutPolicy = DEFAULT_LOCKOUT_POLICY,
): LoginFailureState {
  const failedLoginCount = current.failedLoginCount + 1;

  if (failedLoginCount >= policy.maxFailedAttempts) {
    return {
      failedLoginCount: 0,
      lockedUntil: new Date(now.getTime() + policy.lockMinutes * 60_000),
    };
  }

  return { failedLoginCount, lockedUntil: null };
}
