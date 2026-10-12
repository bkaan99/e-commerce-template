import Decimal from "decimal.js";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuditEntry } from "@/shared/audit/audit-logger";
import type { DealerRepository } from "./dealer.repository";
import { DealerService, type DealerMailer } from "./dealer.service";
import type { DealerProfile, DealerStatus } from "./dealer.types";
import { vknCheckDigit } from "./vkn";

const actor = { userId: "staff", ip: null };
const vkn = `123456789${vknCheckDigit("123456789")}`;
const invalidVkn = `123456789${(vknCheckDigit("123456789") + 1) % 10}`;

const profile = (status: DealerStatus): DealerProfile => ({
  userId: "u1",
  status,
  groupId: null,
  groupName: null,
  companyName: null,
  taxNumber: null,
  taxOffice: null,
  creditLimit: null,
  minOrderAmount: null,
  note: null,
  approvedAt: null,
});

class FakeRepo implements DealerRepository {
  current: DealerProfile | null = profile("NONE");
  applied: unknown[] = [];
  approved: unknown[] = [];
  rejected: (string | null)[] = [];
  groupOk = true;

  async findProfile() {
    return this.current;
  }
  async findContact() {
    return { email: "bayi@example.com", name: "Bayi" };
  }
  async apply(_u: string, input: unknown) {
    this.applied.push(input);
  }
  async listApplications() {
    return [];
  }
  async groupExists() {
    return this.groupOk;
  }
  async listGroups() {
    return [];
  }
  async approve(_u: string, input: unknown) {
    this.approved.push(input);
  }
  async reject(_u: string, note: string | null) {
    this.rejected.push(note);
  }
  async updateTerms() {}
  async outstandingDeferredTotal() {
    return new Decimal(0);
  }
}

describe("DealerService", () => {
  let repo: FakeRepo;
  let audit: AuditEntry[];
  let mails: string[];
  let service: DealerService;

  beforeEach(() => {
    repo = new FakeRepo();
    audit = [];
    mails = [];
    const mailer: DealerMailer = {
      sendDealerApplicationToAdmin: async (a) =>
        void mails.push(`admin:${a.companyName}`),
      sendDealerDecision: async (_e, approved) =>
        void mails.push(`dealer:${approved}`),
    };
    service = new DealerService(repo, mailer, {
      log: async (entry) => void audit.push(entry),
      purgeOlderThan: async () => 0,
    });
  });

  const application = {
    companyName: "Örnek A.Ş.",
    taxNumber: vkn,
    taxOffice: "Kadıköy",
  };

  it("geçerli başvuruyu kaydeder ve yöneticiyi bilgilendirir", async () => {
    await service.apply("u1", application);
    expect(repo.applied).toHaveLength(1);
    expect(mails).toEqual(["admin:Örnek A.Ş."]);
  });

  it("geçersiz vergi numarasını reddeder", async () => {
    await expect(
      service.apply("u1", { ...application, taxNumber: invalidVkn }),
    ).rejects.toThrow("vergi numarası");
  });

  it("bekleyen veya onaylı başvuruyu tekrar kabul etmez", async () => {
    repo.current = profile("PENDING");
    await expect(service.apply("u1", application)).rejects.toThrow(
      "inceleniyor",
    );

    repo.current = profile("APPROVED");
    await expect(service.apply("u1", application)).rejects.toThrow(
      "onaylı bir bayi",
    );
  });

  it("reddedilen başvuru yeniden yapılabilir", async () => {
    repo.current = profile("REJECTED");
    await service.apply("u1", application);
    expect(repo.applied).toHaveLength(1);
  });

  it("onaylar, denetim kaydı yazar ve bayiye e-posta gönderir", async () => {
    repo.current = profile("PENDING");
    await service.approve(
      "u1",
      { groupId: "g1", creditLimit: "5000,50", minOrderAmount: "" },
      actor,
    );

    expect(repo.approved[0]).toEqual({
      groupId: "g1",
      creditLimit: 5000.5,
      minOrderAmount: null,
    });
    expect(audit[0]).toMatchObject({
      action: "dealer.approve",
      before: { status: "PENDING" },
    });
    expect(mails).toEqual(["dealer:true"]);
  });

  it("grup seçilmeden veya var olmayan grupla onaylamaz", async () => {
    repo.current = profile("PENDING");
    await expect(service.approve("u1", { groupId: "" }, actor)).rejects.toThrow(
      "grubu seçin",
    );

    repo.groupOk = false;
    await expect(
      service.approve("u1", { groupId: "yok" }, actor),
    ).rejects.toThrow("bulunamadı");
    expect(repo.approved).toHaveLength(0);
  });

  it("başvurusu olmayan kullanıcıyı onaylamaz", async () => {
    repo.current = profile("NONE");
    await expect(
      service.approve("u1", { groupId: "g1" }, actor),
    ).rejects.toThrow("başvurusu yapmamış");
  });

  it("zaten onaylı bayiyi yeniden onaylarken tekrar e-posta göndermez", async () => {
    repo.current = profile("APPROVED");
    await service.approve("u1", { groupId: "g1" }, actor);
    expect(mails).toEqual([]);
  });

  it("reddeder, notu kaydeder ve e-posta gönderir", async () => {
    repo.current = profile("PENDING");
    await service.reject("u1", "  Eksik belge ", actor);

    expect(repo.rejected).toEqual(["Eksik belge"]);
    expect(mails).toEqual(["dealer:false"]);
    expect(audit[0]).toMatchObject({ action: "dealer.reject" });
  });
});
