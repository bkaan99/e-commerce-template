import type { AuthUserRecord, AuthUserRepository } from "./auth.repository";
import {
  DEFAULT_LOCKOUT_POLICY,
  isLocked,
  nextStateAfterFailure,
  type LockoutPolicy,
} from "./lockout-policy";
import type { PasswordHasher } from "./password-hasher";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  type: AuthUserRecord["type"];
}

export interface AuthServiceDeps {
  users: AuthUserRepository;
  hasher: PasswordHasher;
  now?: () => Date;
  lockoutPolicy?: LockoutPolicy;
}

export class AuthService {
  private readonly users: AuthUserRepository;
  private readonly hasher: PasswordHasher;
  private readonly now: () => Date;
  private readonly policy: LockoutPolicy;
  private dummyHash: Promise<string> | undefined;

  constructor(deps: AuthServiceDeps) {
    this.users = deps.users;
    this.hasher = deps.hasher;
    this.now = deps.now ?? (() => new Date());
    this.policy = deps.lockoutPolicy ?? DEFAULT_LOCKOUT_POLICY;
  }

  /**
   * E-posta ve parolayı doğrular. Hata nedenini (yok, pasif, kilitli, yanlış parola)
   * dışarıya ayırt ettirmez; hepsi için `null` döner.
   */
  async authenticate(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser | null> {
    const user = await this.users.findByEmail(email.trim().toLowerCase());

    if (!user || !user.passwordHash) {
      await this.equalizeTiming(password);
      return null;
    }

    if (!user.isActive || user.anonymized) return null;

    const now = this.now();
    if (isLocked(user, now)) return null;

    const valid = await this.hasher.verify(user.passwordHash, password);

    if (!valid) {
      await this.users.saveLoginState(
        user.id,
        nextStateAfterFailure(user, now, this.policy),
      );
      return null;
    }

    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.users.saveLoginState(user.id, {
        failedLoginCount: 0,
        lockedUntil: null,
      });
    }

    return {
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      type: user.type,
    };
  }

  /** Kullanıcı yokken de parola doğrulama süresi harcanır; e-posta varlığı sızmaz. */
  private async equalizeTiming(password: string): Promise<void> {
    this.dummyHash ??= this.hasher.hash("timing-equalization");
    await this.hasher.verify(await this.dummyHash, password);
  }
}
