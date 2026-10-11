import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUserRecord, AuthUserRepository } from "./auth.repository";
import { AuthService } from "./auth.service";
import type { LoginFailureState } from "./lockout-policy";
import type { PasswordHasher } from "./password-hasher";

class FakeHasher implements PasswordHasher {
  verifyCalls = 0;
  async hash(plain: string): Promise<string> {
    return `h:${plain}`;
  }
  async verify(hashed: string, plain: string): Promise<boolean> {
    this.verifyCalls += 1;
    return hashed === `h:${plain}`;
  }
}

class FakeUsers implements AuthUserRepository {
  constructor(public user: AuthUserRecord | null) {}
  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    return this.user?.email === email ? this.user : null;
  }
  async findById(): Promise<AuthUserRecord | null> {
    return this.user;
  }
  async saveLoginState(_id: string, state: LoginFailureState): Promise<void> {
    if (this.user) {
      this.user.failedLoginCount = state.failedLoginCount;
      this.user.lockedUntil = state.lockedUntil;
    }
  }
}

function makeUser(overrides: Partial<AuthUserRecord> = {}): AuthUserRecord {
  return {
    id: "u1",
    email: "ali@example.com",
    firstName: "Ali",
    lastName: "Veli",
    type: "CUSTOMER",
    isActive: true,
    anonymized: false,
    passwordHash: "h:dogru-parola",
    failedLoginCount: 0,
    lockedUntil: null,
    permissions: [],
    ...overrides,
  };
}

describe("AuthService", () => {
  let now: Date;
  let hasher: FakeHasher;
  let users: FakeUsers;
  let service: AuthService;

  beforeEach(() => {
    now = new Date("2026-01-01T12:00:00Z");
    hasher = new FakeHasher();
    users = new FakeUsers(makeUser());
    service = new AuthService({ users, hasher, now: () => now });
  });

  it("doğru parolayla kullanıcıyı döndürür", async () => {
    const result = await service.authenticate(
      "ali@example.com",
      "dogru-parola",
    );
    expect(result).toEqual({
      id: "u1",
      email: "ali@example.com",
      name: "Ali Veli",
      type: "CUSTOMER",
    });
  });

  it("e-postayı normalleştirir", async () => {
    const result = await service.authenticate(
      "  ALI@Example.com ",
      "dogru-parola",
    );
    expect(result?.id).toBe("u1");
  });

  it("yanlış parolada null döner ve sayacı artırır", async () => {
    expect(await service.authenticate("ali@example.com", "yanlis")).toBeNull();
    expect(users.user?.failedLoginCount).toBe(1);
  });

  it("5. hatalı denemede hesabı kilitler; doğru parola da reddedilir", async () => {
    for (let i = 0; i < 5; i++) {
      await service.authenticate("ali@example.com", "yanlis");
    }
    expect(users.user?.lockedUntil).not.toBeNull();

    expect(
      await service.authenticate("ali@example.com", "dogru-parola"),
    ).toBeNull();
  });

  it("kilit süresi dolunca tekrar giriş yapılabilir", async () => {
    for (let i = 0; i < 5; i++) {
      await service.authenticate("ali@example.com", "yanlis");
    }
    now = new Date(now.getTime() + 16 * 60_000);

    const result = await service.authenticate(
      "ali@example.com",
      "dogru-parola",
    );
    expect(result?.id).toBe("u1");
    expect(users.user?.lockedUntil).toBeNull();
  });

  it("başarılı girişte hatalı deneme sayacını sıfırlar", async () => {
    users.user!.failedLoginCount = 3;
    await service.authenticate("ali@example.com", "dogru-parola");
    expect(users.user?.failedLoginCount).toBe(0);
  });

  it("kullanıcı yokken de parola doğrulama süresi harcar", async () => {
    const spy = vi.spyOn(hasher, "verify");
    expect(await service.authenticate("yok@example.com", "x")).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("pasif ve anonimleştirilmiş kullanıcıyı reddeder", async () => {
    users.user = makeUser({ isActive: false });
    expect(
      await service.authenticate("ali@example.com", "dogru-parola"),
    ).toBeNull();

    users.user = makeUser({ anonymized: true });
    expect(
      await service.authenticate("ali@example.com", "dogru-parola"),
    ).toBeNull();
  });
});
