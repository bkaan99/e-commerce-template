import { beforeEach, describe, expect, it } from "vitest";
import type { AuditEntry } from "@/shared/audit/audit-logger";
import type { PasswordHasher } from "../auth/password-hasher";
import type { PrivacyRepository, UserDataExport } from "./privacy.repository";
import { PrivacyService } from "./privacy.service";

class FakeHasher implements PasswordHasher {
  async hash(plain: string) {
    return `h:${plain}`;
  }
  async verify(hashed: string, plain: string) {
    return hashed === `h:${plain}`;
  }
}

class FakeRepo implements PrivacyRepository {
  identity: Awaited<ReturnType<PrivacyRepository["findIdentity"]>> = {
    email: "ali@example.com",
    type: "CUSTOMER",
    passwordHash: "h:parola12345",
    anonymized: false,
  };
  openOrders = 0;
  anonymized: string[] = [];
  exportData: UserDataExport | null = {
    exportedAt: "2026-01-01T00:00:00Z",
    account: {
      email: "ali@example.com",
      firstName: "Ali",
      lastName: "Veli",
      phone: null,
      emailVerified: true,
      createdAt: "2025-01-01T00:00:00Z",
    },
    addresses: [],
    orders: [],
    wishlist: [],
    dealer: null,
    stockAlerts: [],
  };

  async collectExport() {
    return this.exportData;
  }
  async openOrderCount() {
    return this.openOrders;
  }
  async findIdentity() {
    return this.identity;
  }
  async anonymize(userId: string) {
    this.anonymized.push(userId);
  }
}

describe("PrivacyService", () => {
  let repo: FakeRepo;
  let audit: AuditEntry[];
  let service: PrivacyService;

  beforeEach(() => {
    repo = new FakeRepo();
    audit = [];
    service = new PrivacyService(repo, new FakeHasher(), {
      log: async (entry) => void audit.push(entry),
      purgeOlderThan: async () => 0,
    });
  });

  it("veriyi dışa aktarır ve denetim kaydı yazar", async () => {
    const data = await service.exportData("u1");
    expect(data.account.email).toBe("ali@example.com");
    expect(audit[0]).toMatchObject({
      action: "privacy.export",
      entityId: "u1",
    });
  });

  it("var olmayan hesapta NotFound verir", async () => {
    repo.exportData = null;
    await expect(service.exportData("yok")).rejects.toThrow("Hesap bulunamadı");
  });

  it("doğru parolayla ve açık sipariş yokken hesabı anonimleştirir", async () => {
    await service.deleteAccount("u1", "parola12345");
    expect(repo.anonymized).toEqual(["u1"]);
    expect(audit[0]).toMatchObject({ action: "privacy.delete-account" });
  });

  it("yanlış parolada silmez", async () => {
    await expect(service.deleteAccount("u1", "yanlis")).rejects.toThrow(
      "Parolanız hatalı",
    );
    expect(repo.anonymized).toHaveLength(0);
  });

  it("açık siparişi olan hesabı silmez", async () => {
    repo.openOrders = 2;
    await expect(service.deleteAccount("u1", "parola12345")).rejects.toThrow(
      "Tamamlanmamış siparişleriniz var",
    );
    expect(repo.anonymized).toHaveLength(0);
  });

  it("personel ve zaten silinmiş hesabı silmez", async () => {
    repo.identity = { ...repo.identity!, type: "STAFF" };
    await expect(service.deleteAccount("u1", "parola12345")).rejects.toThrow(
      "Personel hesapları",
    );

    repo.identity = { ...repo.identity!, type: "CUSTOMER", anonymized: true };
    await expect(service.deleteAccount("u1", "parola12345")).rejects.toThrow(
      "Hesap bulunamadı",
    );
  });
});
