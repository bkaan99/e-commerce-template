import type { PrismaClient } from "@/shared/prisma-client";
import { PERMISSIONS } from "@/shared/permissions";
import type { RoleInput, StaffInvite } from "./role.schema";

export interface RoleRecord {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

export interface StaffRecord {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  hasPassword: boolean;
  roles: { id: string; name: string }[];
}

export interface StaffRepository {
  listRoles(): Promise<RoleRecord[]>;
  findRole(id: string): Promise<RoleRecord | null>;
  findRolesByIds(ids: string[]): Promise<RoleRecord[]>;
  roleNameTaken(name: string, excludeId?: string): Promise<boolean>;
  createRole(input: RoleInput): Promise<string>;
  updateRole(id: string, input: RoleInput): Promise<void>;
  deleteRole(id: string): Promise<void>;
  listStaff(): Promise<StaffRecord[]>;
  findStaff(id: string): Promise<StaffRecord | null>;
  emailTaken(email: string): Promise<boolean>;
  createStaff(input: StaffInvite): Promise<string>;
  setRoles(userId: string, roleIds: string[]): Promise<void>;
  setActive(userId: string, isActive: boolean): Promise<void>;
  /**
   * Rol yönetebilen etkin personel sayısı; verilen kullanıcı veya rolün
   * katkısı hariç tutulur (son yöneticinin kilitlenmesini önlemek için).
   */
  countActiveManagers(exclude: {
    userId?: string;
    roleId?: string;
  }): Promise<number>;
}

const roleSelect = {
  id: true,
  name: true,
  description: true,
  isSystem: true,
  permissions: { select: { permission: true } },
  _count: { select: { users: true } },
} as const;

function toRole(row: {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: { permission: string }[];
  _count: { users: number };
}): RoleRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isSystem: row.isSystem,
    permissions: row.permissions.map((p) => p.permission).sort(),
    userCount: row._count.users,
  };
}

const staffSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  isActive: true,
  passwordHash: true,
  roles: { select: { role: { select: { id: true, name: true } } } },
} as const;

function toStaff(row: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  passwordHash: string | null;
  roles: { role: { id: string; name: string } }[];
}): StaffRecord {
  return {
    id: row.id,
    email: row.email,
    name: `${row.firstName} ${row.lastName}`.trim(),
    isActive: row.isActive,
    hasPassword: row.passwordHash !== null,
    roles: row.roles.map((r) => r.role),
  };
}

export class PrismaStaffRepository implements StaffRepository {
  constructor(private readonly db: () => PrismaClient) {}

  async listRoles(): Promise<RoleRecord[]> {
    const rows = await this.db().role.findMany({
      select: roleSelect,
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
    return rows.map(toRole);
  }

  async findRole(id: string): Promise<RoleRecord | null> {
    const row = await this.db().role.findUnique({
      where: { id },
      select: roleSelect,
    });
    return row ? toRole(row) : null;
  }

  async findRolesByIds(ids: string[]): Promise<RoleRecord[]> {
    const rows = await this.db().role.findMany({
      where: { id: { in: ids } },
      select: roleSelect,
    });
    return rows.map(toRole);
  }

  async roleNameTaken(name: string, excludeId?: string): Promise<boolean> {
    const found = await this.db().role.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    return found !== null;
  }

  async createRole(input: RoleInput): Promise<string> {
    const role = await this.db().role.create({
      data: {
        name: input.name,
        description: input.description,
        permissions: {
          create: input.permissions.map((permission) => ({ permission })),
        },
      },
      select: { id: true },
    });
    return role.id;
  }

  async updateRole(id: string, input: RoleInput): Promise<void> {
    await this.db().$transaction([
      this.db().role.update({
        where: { id },
        data: { name: input.name, description: input.description },
      }),
      this.db().rolePermission.deleteMany({ where: { roleId: id } }),
      this.db().rolePermission.createMany({
        data: input.permissions.map((permission) => ({
          roleId: id,
          permission,
        })),
      }),
    ]);
  }

  async deleteRole(id: string): Promise<void> {
    await this.db().role.delete({ where: { id } });
  }

  async listStaff(): Promise<StaffRecord[]> {
    const rows = await this.db().user.findMany({
      where: { type: "STAFF", anonymizedAt: null },
      select: staffSelect,
      orderBy: [{ isActive: "desc" }, { firstName: "asc" }],
    });
    return rows.map(toStaff);
  }

  async findStaff(id: string): Promise<StaffRecord | null> {
    const row = await this.db().user.findFirst({
      where: { id, type: "STAFF" },
      select: staffSelect,
    });
    return row ? toStaff(row) : null;
  }

  async emailTaken(email: string): Promise<boolean> {
    const found = await this.db().user.findUnique({
      where: { email },
      select: { id: true },
    });
    return found !== null;
  }

  async createStaff(input: StaffInvite): Promise<string> {
    const user = await this.db().user.create({
      data: {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        type: "STAFF",
        passwordHash: null,
        roles: { create: input.roleIds.map((roleId) => ({ roleId })) },
      },
      select: { id: true },
    });
    return user.id;
  }

  async setRoles(userId: string, roleIds: string[]): Promise<void> {
    await this.db().$transaction([
      this.db().userRole.deleteMany({ where: { userId } }),
      this.db().userRole.createMany({
        data: roleIds.map((roleId) => ({ userId, roleId })),
      }),
    ]);
  }

  async setActive(userId: string, isActive: boolean): Promise<void> {
    await this.db().user.update({ where: { id: userId }, data: { isActive } });
  }

  countActiveManagers(exclude: {
    userId?: string;
    roleId?: string;
  }): Promise<number> {
    return this.db().user.count({
      where: {
        type: "STAFF",
        isActive: true,
        anonymizedAt: null,
        ...(exclude.userId ? { id: { not: exclude.userId } } : {}),
        roles: {
          some: {
            ...(exclude.roleId ? { roleId: { not: exclude.roleId } } : {}),
            role: {
              permissions: { some: { permission: PERMISSIONS.ROLE_MANAGE } },
            },
          },
        },
      },
    });
  }
}
