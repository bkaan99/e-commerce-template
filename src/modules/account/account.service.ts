import { createHash } from "node:crypto";
import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors";
import { validatePassword } from "../auth/password-policy";
import type { PasswordHasher } from "../auth/password-hasher";
import { createSignedToken, verifySignedToken } from "../auth/signed-token";

export const PURPOSE_VERIFY_EMAIL = "verify-email";
export const PURPOSE_RESET_PASSWORD = "reset-password";

const VERIFY_TTL_SECONDS = 60 * 60 * 24 * 3;
const RESET_TTL_SECONDS = 60 * 60;

export interface AccountUser {
  id: string;
  email: string;
  passwordHash: string | null;
  emailVerified: boolean;
  isActive: boolean;
}

export interface AccountRepository {
  findByEmail(email: string): Promise<AccountUser | null>;
  findById(id: string): Promise<AccountUser | null>;
  createCustomer(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phone: string | null;
  }): Promise<AccountUser>;
  markEmailVerified(userId: string): Promise<void>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  updateProfile(
    userId: string,
    data: { firstName: string; lastName: string; phone: string | null },
  ): Promise<void>;
  findProfile(userId: string): Promise<{
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
  } | null>;
}

/** Hesap e-postalarını gönderen sözleşme (kuyruk arkasındaki NotificationService). */
export interface AccountMailer {
  sendEmailVerification(email: string, link: string): Promise<void>;
  sendPasswordReset(email: string, link: string): Promise<void>;
}

export interface AccountServiceDeps {
  accounts: AccountRepository;
  hasher: PasswordHasher;
  mailer: AccountMailer;
  secret: string;
  baseUrl: string;
  now?: () => Date;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string | null;
}

/** Şifre değişince sıfırlama bağlantısı da geçersiz olsun diye özetten türetilir. */
function passwordFingerprint(passwordHash: string | null): string {
  return createHash("sha256")
    .update(passwordHash ?? "")
    .digest("hex")
    .slice(0, 16);
}

export class AccountService {
  private readonly now: () => Date;

  constructor(private readonly deps: AccountServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async register(input: RegisterInput): Promise<void> {
    const passwordError = validatePassword(input.password);
    if (passwordError) throw new ValidationError(passwordError);

    const email = input.email.trim().toLowerCase();
    const existing = await this.deps.accounts.findByEmail(email);
    if (existing) {
      throw new ConflictError("Bu e-posta adresiyle zaten bir hesap var");
    }

    const user = await this.deps.accounts.createCustomer({
      email,
      passwordHash: await this.deps.hasher.hash(input.password),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: input.phone,
    });

    await this.sendVerification(user);
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await this.deps.accounts.findById(userId);
    if (!user || user.emailVerified) return;
    await this.sendVerification(user);
  }

  async verifyEmail(token: string): Promise<void> {
    const result = verifySignedToken(token, {
      secret: this.deps.secret,
      purpose: PURPOSE_VERIFY_EMAIL,
      now: this.now(),
    });
    if (!result.valid) {
      throw new ValidationError(
        "Doğrulama bağlantısı geçersiz veya süresi dolmuş",
      );
    }

    const user = await this.deps.accounts.findById(result.payload.subject);
    if (!user) throw new NotFoundError("Hesap");

    // Bağlantı e-posta adresine bağlıdır; adres değiştiyse geçersizdir.
    if (user.email !== result.payload.ctx) {
      throw new ValidationError(
        "Doğrulama bağlantısı geçersiz veya süresi dolmuş",
      );
    }

    if (!user.emailVerified)
      await this.deps.accounts.markEmailVerified(user.id);
  }

  /** Hesap var olsun ya da olmasın aynı şekilde döner; e-posta varlığı sızmaz. */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.deps.accounts.findByEmail(
      email.trim().toLowerCase(),
    );
    if (!user || !user.isActive) return;

    const token = createSignedToken(
      {
        purpose: PURPOSE_RESET_PASSWORD,
        subject: user.id,
        ctx: passwordFingerprint(user.passwordHash),
      },
      {
        secret: this.deps.secret,
        ttlSeconds: RESET_TTL_SECONDS,
        now: this.now(),
      },
    );

    await this.deps.mailer.sendPasswordReset(
      user.email,
      `${this.deps.baseUrl}/sifre-sifirla?token=${encodeURIComponent(token)}`,
    );
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const passwordError = validatePassword(newPassword);
    if (passwordError) throw new ValidationError(passwordError);

    const result = verifySignedToken(token, {
      secret: this.deps.secret,
      purpose: PURPOSE_RESET_PASSWORD,
      now: this.now(),
    });
    const invalid = new ValidationError(
      "Sıfırlama bağlantısı geçersiz veya süresi dolmuş",
    );
    if (!result.valid) throw invalid;

    const user = await this.deps.accounts.findById(result.payload.subject);
    if (!user || !user.isActive) throw invalid;

    // Parola daha önce değiştiyse aynı bağlantı tekrar kullanılamaz.
    if (passwordFingerprint(user.passwordHash) !== result.payload.ctx) {
      throw invalid;
    }

    await this.deps.accounts.updatePassword(
      user.id,
      await this.deps.hasher.hash(newPassword),
    );
  }

  private async sendVerification(user: AccountUser): Promise<void> {
    const token = createSignedToken(
      { purpose: PURPOSE_VERIFY_EMAIL, subject: user.id, ctx: user.email },
      {
        secret: this.deps.secret,
        ttlSeconds: VERIFY_TTL_SECONDS,
        now: this.now(),
      },
    );

    await this.deps.mailer.sendEmailVerification(
      user.email,
      `${this.deps.baseUrl}/dogrula?token=${encodeURIComponent(token)}`,
    );
  }
}
