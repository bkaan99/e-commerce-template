import { beforeEach, describe, expect, it } from "vitest";
import type { PasswordHasher } from "../auth/password-hasher";
import type { AccountRepository, AccountUser } from "./account.service";
import { ProfileService } from "./profile.service";

class FakeHasher implements PasswordHasher {
  async hash(plain: string) {
    return `h:${plain}`;
  }
  async verify(hashed: string, plain: string) {
    return hashed === `h:${plain}`;
  }
}

class FakeRepo implements AccountRepository {
  user: AccountUser | null = {
    id: "u1",
    email: "ali@example.com",
    passwordHash: "h:eskiparola123",
    emailVerified: true,
    isActive: true,
  };
  profile: unknown = null;
  async findByEmail() {
    return this.user;
  }
  async findById() {
    return this.user;
  }
  async createCustomer(): Promise<AccountUser> {
    throw new Error("kullanılmaz");
  }
  async markEmailVerified() {}
  async updatePassword(_id: string, hash: string) {
    this.user!.passwordHash = hash;
  }
  async findProfile() {
    return null;
  }
  async updateProfile(_id: string, data: unknown) {
    this.profile = data;
  }
}

describe("ProfileService", () => {
  let repo: FakeRepo;
  let service: ProfileService;

  beforeEach(() => {
    repo = new FakeRepo();
    service = new ProfileService(repo, new FakeHasher());
  });

  it("profili günceller ve telefonu normalleştirir", async () => {
    await service.updateProfile("u1", {
      firstName: " Ali ",
      lastName: "Veli",
      phone: "+90 555 000 00 00",
    });
    expect(repo.profile).toEqual({
      firstName: "Ali",
      lastName: "Veli",
      phone: "05550000000",
    });
  });

  it("telefonu boş bırakmaya izin verir, geçersizini reddeder", async () => {
    await service.updateProfile("u1", {
      firstName: "Ali",
      lastName: "Veli",
      phone: "",
    });
    expect(repo.profile).toMatchObject({ phone: null });

    await expect(
      service.updateProfile("u1", {
        firstName: "Ali",
        lastName: "Veli",
        phone: "12",
      }),
    ).rejects.toThrow("cep telefonu");
  });

  it("mevcut parola doğruysa parolayı değiştirir", async () => {
    await service.changePassword("u1", "eskiparola123", "yeniparola456");
    expect(repo.user!.passwordHash).toBe("h:yeniparola456");
  });

  it("yanlış mevcut parolayı reddeder", async () => {
    await expect(
      service.changePassword("u1", "yanlis", "yeniparola456"),
    ).rejects.toThrow("Mevcut parolanız hatalı");
    expect(repo.user!.passwordHash).toBe("h:eskiparola123");
  });

  it("zayıf veya aynı yeni parolayı reddeder", async () => {
    await expect(
      service.changePassword("u1", "eskiparola123", "kisa"),
    ).rejects.toThrow("en az 10");
    await expect(
      service.changePassword("u1", "eskiparola123", "eskiparola123"),
    ).rejects.toThrow("aynı olamaz");
  });
});
