import { ConflictError } from "@/shared/errors";
import type { PrismaClient } from "@/shared/prisma-client";
import type { AccountRepository, AccountUser } from "./account.service";

export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly db: () => PrismaClient) {}

  private toUser(row: {
    id: string;
    email: string;
    passwordHash: string | null;
    emailVerifiedAt: Date | null;
    isActive: boolean;
    anonymizedAt: Date | null;
  }): AccountUser {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      emailVerified: row.emailVerifiedAt !== null,
      isActive: row.isActive && row.anonymizedAt === null,
    };
  }

  async findByEmail(email: string): Promise<AccountUser | null> {
    const row = await this.db().user.findUnique({ where: { email } });
    return row ? this.toUser(row) : null;
  }

  async findById(id: string): Promise<AccountUser | null> {
    const row = await this.db().user.findUnique({ where: { id } });
    return row ? this.toUser(row) : null;
  }

  async createCustomer(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phone: string | null;
  }): Promise<AccountUser> {
    try {
      const row = await this.db().user.create({
        data: {
          email: data.email,
          passwordHash: data.passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          type: "CUSTOMER",
          customer: { create: {} },
        },
      });
      return this.toUser(row);
    } catch (error) {
      // Eşzamanlı kayıtta benzersizlik kısıtı yarışı kaybedenin hatasıdır.
      if ((error as { code?: string }).code === "P2002") {
        throw new ConflictError("Bu e-posta adresiyle zaten bir hesap var");
      }
      throw error;
    }
  }

  async markEmailVerified(userId: string): Promise<void> {
    await this.db().user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
  }

  async findProfile(userId: string) {
    return this.db().user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true, phone: true },
    });
  }

  async updateProfile(
    userId: string,
    data: { firstName: string; lastName: string; phone: string | null },
  ): Promise<void> {
    await this.db().user.update({ where: { id: userId }, data });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.db().user.update({
      where: { id: userId },
      // Parola değişince hesap kilidi de açılır.
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    });
  }
}
