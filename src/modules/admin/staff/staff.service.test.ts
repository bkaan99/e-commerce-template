import { beforeEach, describe, expect, it } from "vitest";
import type { AuditEntry } from "@/shared/audit/audit-logger";
import { PERMISSIONS } from "@/shared/permissions";
import type { RoleInput, StaffInvite } from "./role.schema";
import type {
  RoleRecord,
  StaffRecord,
  StaffRepository,
} from "./staff.repository";
import { StaffService, type StaffActor } from "./staff.service";

class FakeRepo implements StaffRepository {
  roles: RoleRecord[] = [
    {
      id: "r-admin",
      name: "admin",
      description: null,
      isSystem: true,
      permissions: Object.values(PERMISSIONS),
      userCount: 1,
    },
    {
      id: "r-editor",
      name: "editor",
      description: null,
      isSystem: true,
      permissions: [PERMISSIONS.PRODUCT_READ, PERMISSIONS.PRODUCT_WRITE],
      userCount: 0,
    },
    {
      id: "r-custom",
      name: "Depo şefi",
      description: null,
      isSystem: false,
      permissions: [PERMISSIONS.ORDER_READ],
      userCount: 0,
    },
  ];
  staff: StaffRecord[] = [
    {
      id: "u-admin",
      email: "admin@x.com",
      name: "Admin",
      isActive: true,
      hasPassword: true,
      roles: [{ id: "r-admin", name: "admin" }],
    },
    {
      id: "u-editor",
      email: "editor@x.com",
      name: "Editör",
      isActive: true,
      hasPassword: true,
      roles: [{ id: "r-editor", name: "editor" }],
    },
  ];
  managers = 2;
  calls: string[] = [];

  async listRoles() {
    return this.roles;
  }
  async findRole(id: string) {
    return this.roles.find((r) => r.id === id) ?? null;
  }
  async findRolesByIds(ids: string[]) {
    return this.roles.filter((r) => ids.includes(r.id));
  }
  async roleNameTaken(name: string, excludeId?: string) {
    return this.roles.some(
      (r) => r.name.toLowerCase() === name.toLowerCase() && r.id !== excludeId,
    );
  }
  async createRole(input: RoleInput) {
    this.calls.push(`createRole:${input.name}`);
    return "r-new";
  }
  async updateRole(id: string) {
    this.calls.push(`updateRole:${id}`);
  }
  async deleteRole(id: string) {
    this.calls.push(`deleteRole:${id}`);
  }
  async listStaff() {
    return this.staff;
  }
  async findStaff(id: string) {
    return this.staff.find((s) => s.id === id) ?? null;
  }
  async emailTaken(email: string) {
    return this.staff.some((s) => s.email === email);
  }
  async createStaff(input: StaffInvite) {
    this.calls.push(`createStaff:${input.email}`);
    return "u-new";
  }
  async setRoles(userId: string, roleIds: string[]) {
    this.calls.push(`setRoles:${userId}:${roleIds.join(",")}`);
  }
  async setActive(userId: string, isActive: boolean) {
    this.calls.push(`setActive:${userId}:${isActive}`);
  }
  async countActiveManagers() {
    return this.managers;
  }
}

const admin: StaffActor = {
  userId: "u-admin",
  ip: null,
  permissions: Object.values(PERMISSIONS),
};

describe("StaffService", () => {
  let repo: FakeRepo;
  let audit: AuditEntry[];
  let sent: string[];
  let service: StaffService;

  beforeEach(() => {
    repo = new FakeRepo();
    audit = [];
    sent = [];
    service = new StaffService(
      repo,
      { sendPasswordSetup: async (email) => void sent.push(email) },
      {
        log: async (entry) => void audit.push(entry),
        purgeOlderThan: async () => 0,
      },
    );
  });

  describe("roller", () => {
    it("özel rol oluşturur ve denetim kaydı yazar", async () => {
      const id = await service.saveRole(
        null,
        { name: "Sevkiyat", permissions: [PERMISSIONS.ORDER_READ] },
        admin,
      );
      expect(id).toBe("r-new");
      expect(audit[0]).toMatchObject({ action: "role.create" });
    });

    it("aynı isimli rolü reddeder", async () => {
      await expect(
        service.saveRole(
          null,
          { name: "EDITOR", permissions: [PERMISSIONS.ORDER_READ] },
          admin,
        ),
      ).rejects.toThrow("zaten var");
    });

    it("kendinde olmayan yetkiyi veremez (yetki yükseltme)", async () => {
      const limited: StaffActor = {
        userId: "u-editor",
        ip: null,
        permissions: [PERMISSIONS.ROLE_MANAGE, PERMISSIONS.ORDER_READ],
      };
      await expect(
        service.saveRole(
          null,
          { name: "Güçlü", permissions: [PERMISSIONS.ORDER_REFUND] },
          limited,
        ),
      ).rejects.toThrow("Kendinizde olmayan");
      expect(repo.calls).toEqual([]);
    });

    it("sistem rolü değiştirilemez ve silinemez", async () => {
      await expect(
        service.saveRole(
          "r-editor",
          { name: "editor", permissions: [PERMISSIONS.PRODUCT_READ] },
          admin,
        ),
      ).rejects.toThrow("Sistem rolleri");
      await expect(service.deleteRole("r-admin", admin)).rejects.toThrow(
        "Sistem rolleri",
      );
    });

    it("kullanıcıya atanmış rol silinemez", async () => {
      repo.roles[2]!.userCount = 3;
      await expect(service.deleteRole("r-custom", admin)).rejects.toThrow(
        "3 personel",
      );
    });

    it("rol yönetimi yetkisini son yöneticiden alacak güncellemeyi engeller", async () => {
      repo.roles[2]!.permissions = [PERMISSIONS.ROLE_MANAGE];
      repo.managers = 0;
      await expect(
        service.saveRole(
          "r-custom",
          { name: "Depo şefi", permissions: [PERMISSIONS.ORDER_READ] },
          admin,
        ),
      ).rejects.toThrow("en az bir etkin");
    });
  });

  describe("personel", () => {
    it("personeli oluşturur ve parola belirleme e-postası gönderir", async () => {
      const id = await service.invite(
        {
          email: "Yeni@X.com ",
          firstName: "Ayşe",
          lastName: "Kaya",
          roleIds: ["r-custom"],
        },
        admin,
      );
      expect(id).toBe("u-new");
      expect(sent).toEqual(["yeni@x.com"]);
      expect(audit[0]).toMatchObject({ action: "staff.invite" });
    });

    it("kayıtlı e-postayı reddeder", async () => {
      await expect(
        service.invite(
          {
            email: "editor@x.com",
            firstName: "A",
            lastName: "B",
            roleIds: ["r-custom"],
          },
          admin,
        ),
      ).rejects.toThrow("zaten kayıtlı");
      expect(sent).toEqual([]);
    });

    it("kendi rollerini veya durumunu değiştiremez", async () => {
      await expect(
        service.setRoles("u-admin", ["r-custom"], admin),
      ).rejects.toThrow("Kendi yetkilerinizi");
      await expect(service.setActive("u-admin", false, admin)).rejects.toThrow(
        "Kendi yetkilerinizi",
      );
    });

    it("rol atar ve değişikliği denetler", async () => {
      await service.setRoles("u-editor", ["r-custom"], admin);
      expect(repo.calls).toContain("setRoles:u-editor:r-custom");
      expect(audit[0]).toMatchObject({ action: "staff.roles" });
    });

    it("son yöneticiyi pasifleştirmeyi ve rolünü almayı engeller", async () => {
      repo.managers = 0;
      await expect(service.setActive("u-editor", false, admin)).rejects.toThrow(
        "en az bir etkin",
      );

      repo.staff[1]!.roles = [{ id: "r-admin", name: "admin" }];
      await expect(
        service.setRoles("u-editor", ["r-custom"], admin),
      ).rejects.toThrow("en az bir etkin");
    });

    it("pasif personeli yeniden etkinleştirir", async () => {
      repo.staff[1]!.isActive = false;
      await service.setActive("u-editor", true, admin);
      expect(repo.calls).toContain("setActive:u-editor:true");
      expect(audit[0]).toMatchObject({ action: "staff.activate" });
    });

    it("parolasını belirlememiş personele daveti yeniden gönderir", async () => {
      repo.staff[1]!.hasPassword = false;
      await service.resendInvite("u-editor", admin);
      expect(sent).toEqual(["editor@x.com"]);
      await expect(service.resendInvite("u-admin", admin)).rejects.toThrow(
        "zaten belirlemiş",
      );
    });
  });
});
