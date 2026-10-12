import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PERMISSIONS } from "@/shared/permissions";
import { createPrismaClient, type PrismaClient } from "@/shared/prisma-client";
import { PrismaStaffRepository } from "./staff.repository";

describe("PrismaStaffRepository", () => {
  const tag = randomUUID().slice(0, 8);
  let db: PrismaClient;
  let repo: PrismaStaffRepository;
  const userIds: string[] = [];
  const roleIds: string[] = [];

  beforeAll(async () => {
    db = createPrismaClient(process.env["TEST_DATABASE_URL"]!);
    repo = new PrismaStaffRepository(() => db);
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.role.deleteMany({ where: { id: { in: roleIds } } });
    await db.$disconnect();
  });

  it("rol oluşturur, günceller ve yetkileri değiştirir", async () => {
    const id = await repo.createRole({
      name: `Test Rol ${tag}`,
      description: null,
      permissions: [PERMISSIONS.ORDER_READ],
    });
    roleIds.push(id);
    expect(await repo.roleNameTaken(`test rol ${tag}`)).toBe(true);
    expect(await repo.roleNameTaken(`test rol ${tag}`, id)).toBe(false);

    await repo.updateRole(id, {
      name: `Test Rol ${tag}`,
      description: "Açıklama",
      permissions: [PERMISSIONS.ORDER_READ, PERMISSIONS.REPORT_VIEW],
    });
    const role = await repo.findRole(id);
    expect(role).toMatchObject({
      description: "Açıklama",
      isSystem: false,
      userCount: 0,
    });
    expect(role?.permissions).toEqual(["order.read", "report.view"]);
  });

  it("personel oluşturur ve yönetici sayımında rol/kullanıcı katkısını hariç tutar", async () => {
    const managerRole = await repo.createRole({
      name: `Yönetici ${tag}`,
      description: null,
      permissions: [PERMISSIONS.ROLE_MANAGE],
    });
    roleIds.push(managerRole);

    const before = await repo.countActiveManagers({});
    const userId = await repo.createStaff({
      email: `staff-${tag}@example.com`,
      firstName: "Test",
      lastName: "Personel",
      roleIds: [managerRole],
    });
    userIds.push(userId);

    expect(await repo.emailTaken(`staff-${tag}@example.com`)).toBe(true);
    expect(await repo.countActiveManagers({})).toBe(before + 1);
    expect(await repo.countActiveManagers({ userId })).toBe(before);
    expect(await repo.countActiveManagers({ roleId: managerRole })).toBe(
      before,
    );

    await repo.setActive(userId, false);
    expect(await repo.countActiveManagers({})).toBe(before);

    const staff = await repo.findStaff(userId);
    expect(staff).toMatchObject({ isActive: false, hasPassword: false });
  });
});
