import { beforeEach, describe, expect, it } from "vitest";
import type { PasswordHasher } from "../auth/password-hasher";
import {
  AccountService,
  type AccountMailer,
  type AccountRepository,
  type AccountUser,
} from "./account.service";

class FakeHasher implements PasswordHasher {
  async hash(plain: string) {
    return `h:${plain}`;
  }
  async verify(hashed: string, plain: string) {
    return hashed === `h:${plain}`;
  }
}

class FakeRepo implements AccountRepository {
  users = new Map<string, AccountUser>();
  private seq = 0;

  async findByEmail(email: string) {
    return [...this.users.values()].find((u) => u.email === email) ?? null;
  }
  async findById(id: string) {
    return this.users.get(id) ?? null;
  }
  async createCustomer(data: { email: string; passwordHash: string }) {
    const user: AccountUser = {
      id: `u${++this.seq}`,
      email: data.email,
      passwordHash: data.passwordHash,
      emailVerified: false,
      isActive: true,
    };
    this.users.set(user.id, user);
    return user;
  }
  async markEmailVerified(userId: string) {
    this.users.get(userId)!.emailVerified = true;
  }
  async findProfile() {
    return null;
  }
  async updateProfile() {}
  async updatePassword(userId: string, passwordHash: string) {
    this.users.get(userId)!.passwordHash = passwordHash;
  }
}

class FakeMailer implements AccountMailer {
  verifications: { email: string; link: string }[] = [];
  resets: { email: string; link: string }[] = [];
  async sendEmailVerification(email: string, link: string) {
    this.verifications.push({ email, link });
  }
  async sendPasswordReset(email: string, link: string) {
    this.resets.push({ email, link });
  }
}

const tokenFrom = (link: string) =>
  decodeURIComponent(new URL(link).searchParams.get("token")!);

describe("AccountService", () => {
  let repo: FakeRepo;
  let mailer: FakeMailer;
  let now: Date;
  let service: AccountService;

  const input = {
    email: " Ali@Example.com ",
    password: "guvenliparola1",
    firstName: "Ali",
    lastName: "Veli",
    phone: null,
  };

  beforeEach(() => {
    repo = new FakeRepo();
    mailer = new FakeMailer();
    now = new Date("2026-01-01T12:00:00Z");
    service = new AccountService({
      accounts: repo,
      hasher: new FakeHasher(),
      mailer,
      secret: "s".repeat(32),
      baseUrl: "https://site.test",
      now: () => now,
    });
  });

  it("kayıt olur, parolayı özetleyerek saklar ve doğrulama e-postası gönderir", async () => {
    await service.register(input);

    const user = await repo.findByEmail("ali@example.com");
    expect(user?.passwordHash).toBe("h:guvenliparola1");
    expect(mailer.verifications[0]!.link).toContain(
      "https://site.test/dogrula?token=",
    );
  });

  it("zayıf parolayı reddeder", async () => {
    await expect(
      service.register({ ...input, password: "kisa" }),
    ).rejects.toThrow("en az 10");
  });

  it("aynı e-postayla ikinci kaydı reddeder", async () => {
    await service.register(input);
    await expect(service.register(input)).rejects.toThrow(
      "zaten bir hesap var",
    );
  });

  it("doğrulama bağlantısıyla e-postayı doğrular", async () => {
    await service.register(input);
    await service.verifyEmail(tokenFrom(mailer.verifications[0]!.link));

    expect((await repo.findByEmail("ali@example.com"))!.emailVerified).toBe(
      true,
    );
  });

  it("süresi dolan doğrulama bağlantısını reddeder", async () => {
    await service.register(input);
    const token = tokenFrom(mailer.verifications[0]!.link);
    now = new Date(now.getTime() + 4 * 24 * 3600 * 1000);

    await expect(service.verifyEmail(token)).rejects.toThrow("süresi dolmuş");
  });

  it("şifre sıfırlama: var olmayan hesapta sessizce döner", async () => {
    await service.requestPasswordReset("yok@example.com");
    expect(mailer.resets).toHaveLength(0);
  });

  it("şifreyi sıfırlar ve aynı bağlantının ikinci kullanımını engeller", async () => {
    await service.register(input);
    await service.requestPasswordReset("ali@example.com");
    const token = tokenFrom(mailer.resets[0]!.link);

    await service.resetPassword(token, "yeniparola123");
    expect((await repo.findByEmail("ali@example.com"))!.passwordHash).toBe(
      "h:yeniparola123",
    );

    await expect(
      service.resetPassword(token, "baskaparola123"),
    ).rejects.toThrow("geçersiz");
  });

  it("sıfırlama bağlantısı 1 saat sonra geçersizdir", async () => {
    await service.register(input);
    await service.requestPasswordReset("ali@example.com");
    const token = tokenFrom(mailer.resets[0]!.link);
    now = new Date(now.getTime() + 2 * 3600 * 1000);

    await expect(service.resetPassword(token, "yeniparola123")).rejects.toThrow(
      "süresi dolmuş",
    );
  });

  it("doğrulama belirteciyle şifre sıfırlanamaz (amaç ayrımı)", async () => {
    await service.register(input);
    const verifyToken = tokenFrom(mailer.verifications[0]!.link);

    await expect(
      service.resetPassword(verifyToken, "yeniparola123"),
    ).rejects.toThrow("geçersiz");
  });
});
