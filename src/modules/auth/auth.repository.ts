import { getDb } from "@/shared/db";
import type { UserType } from "../../../generated/prisma/client";
import type { LoginFailureState } from "./lockout-policy";

export interface AuthUserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  type: UserType;
  isActive: boolean;
  anonymized: boolean;
  passwordHash: string | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  permissions: string[];
}

export interface AuthUserRepository {
  findByEmail(email: string): Promise<AuthUserRecord | null>;
  findById(id: string): Promise<AuthUserRecord | null>;
  saveLoginState(userId: string, state: LoginFailureState): Promise<void>;
}

const userWithPermissions = {
  roles: {
    select: {
      role: { select: { permissions: { select: { permission: true } } } },
    },
  },
} as const;

export class PrismaAuthUserRepository implements AuthUserRepository {
  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const user = await getDb().user.findUnique({
      where: { email },
      include: userWithPermissions,
    });
    return user ? this.toRecord(user) : null;
  }

  async findById(id: string): Promise<AuthUserRecord | null> {
    const user = await getDb().user.findUnique({
      where: { id },
      include: userWithPermissions,
    });
    return user ? this.toRecord(user) : null;
  }

  async saveLoginState(
    userId: string,
    state: LoginFailureState,
  ): Promise<void> {
    await getDb().user.update({
      where: { id: userId },
      data: {
        failedLoginCount: state.failedLoginCount,
        lockedUntil: state.lockedUntil,
      },
    });
  }

  private toRecord(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    type: UserType;
    isActive: boolean;
    anonymizedAt: Date | null;
    passwordHash: string | null;
    failedLoginCount: number;
    lockedUntil: Date | null;
    roles: { role: { permissions: { permission: string }[] } }[];
  }): AuthUserRecord {
    const permissions = new Set<string>();
    for (const { role } of user.roles) {
      for (const { permission } of role.permissions) {
        permissions.add(permission);
      }
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      type: user.type,
      isActive: user.isActive,
      anonymized: user.anonymizedAt !== null,
      passwordHash: user.passwordHash,
      failedLoginCount: user.failedLoginCount,
      lockedUntil: user.lockedUntil,
      permissions: [...permissions],
    };
  }
}
