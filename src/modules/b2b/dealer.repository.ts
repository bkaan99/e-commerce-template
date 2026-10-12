import Decimal from "decimal.js";
import type { PrismaClient } from "@/shared/prisma-client";
import type {
  DealerApplicationInput,
  DealerApplicationRow,
  DealerApprovalInput,
  DealerProfile,
  DealerStatus,
} from "./dealer.types";

export interface GroupOption {
  id: string;
  name: string;
  discountPercent: string | null;
}

export interface DealerRepository {
  findProfile(userId: string): Promise<DealerProfile | null>;
  findContact(userId: string): Promise<{ email: string; name: string } | null>;
  apply(userId: string, input: DealerApplicationInput): Promise<void>;
  listApplications(filter: {
    status?: DealerStatus;
    search?: string;
  }): Promise<DealerApplicationRow[]>;
  groupExists(groupId: string): Promise<boolean>;
  listGroups(): Promise<GroupOption[]>;
  approve(userId: string, input: DealerApprovalInput): Promise<void>;
  reject(userId: string, note: string | null): Promise<void>;
  updateTerms(userId: string, input: DealerApprovalInput): Promise<void>;
  /** Ödenmemiş vadeli sipariş toplamı (kredi kullanımı). */
  outstandingDeferredTotal(userId: string): Promise<Decimal>;
}

export class PrismaDealerRepository implements DealerRepository {
  constructor(private readonly db: () => PrismaClient) {}

  async findProfile(userId: string): Promise<DealerProfile | null> {
    const customer = await this.db().customer.findUnique({
      where: { userId },
      include: { group: { select: { name: true } } },
    });
    if (!customer) return null;

    return {
      userId,
      status: customer.b2bStatus,
      groupId: customer.groupId,
      groupName: customer.group?.name ?? null,
      companyName: customer.companyName,
      taxNumber: customer.taxNumber,
      taxOffice: customer.taxOffice,
      creditLimit: customer.creditLimit?.toFixed(2) ?? null,
      minOrderAmount: customer.minOrderAmount?.toFixed(2) ?? null,
      note: customer.b2bNote,
      approvedAt: customer.approvedAt,
    };
  }

  async findContact(userId: string) {
    const user = await this.db().user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });
    return user
      ? { email: user.email, name: `${user.firstName} ${user.lastName}`.trim() }
      : null;
  }

  async apply(userId: string, input: DealerApplicationInput): Promise<void> {
    await this.db().customer.upsert({
      where: { userId },
      update: {
        b2bStatus: "PENDING",
        companyName: input.companyName,
        taxNumber: input.taxNumber,
        taxOffice: input.taxOffice,
        b2bNote: null,
      },
      create: {
        userId,
        b2bStatus: "PENDING",
        companyName: input.companyName,
        taxNumber: input.taxNumber,
        taxOffice: input.taxOffice,
      },
    });
  }

  async listApplications(filter: {
    status?: DealerStatus;
    search?: string;
  }): Promise<DealerApplicationRow[]> {
    const search = filter.search?.trim();
    const rows = await this.db().customer.findMany({
      where: {
        b2bStatus: filter.status ?? { not: "NONE" },
        ...(search
          ? {
              OR: [
                { companyName: { contains: search, mode: "insensitive" } },
                { taxNumber: { contains: search } },
                { user: { email: { contains: search, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: { user: true, group: { select: { name: true } } },
    });

    return rows.map((row) => ({
      userId: row.userId,
      name: `${row.user.firstName} ${row.user.lastName}`.trim(),
      email: row.user.email,
      phone: row.user.phone,
      status: row.b2bStatus,
      companyName: row.companyName,
      taxNumber: row.taxNumber,
      taxOffice: row.taxOffice,
      groupId: row.groupId,
      groupName: row.group?.name ?? null,
      creditLimit: row.creditLimit?.toFixed(2) ?? null,
      minOrderAmount: row.minOrderAmount?.toFixed(2) ?? null,
      note: row.b2bNote,
      createdAt: row.createdAt,
    }));
  }

  async groupExists(groupId: string): Promise<boolean> {
    return (
      (await this.db().customerGroup.findUnique({ where: { id: groupId } })) !==
      null
    );
  }

  async listGroups(): Promise<GroupOption[]> {
    const groups = await this.db().customerGroup.findMany({
      orderBy: { name: "asc" },
    });
    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      discountPercent: group.discountPercent?.toString() ?? null,
    }));
  }

  async approve(userId: string, input: DealerApprovalInput): Promise<void> {
    await this.db().customer.update({
      where: { userId },
      data: {
        b2bStatus: "APPROVED",
        groupId: input.groupId,
        creditLimit: input.creditLimit,
        minOrderAmount: input.minOrderAmount,
        approvedAt: new Date(),
        b2bNote: null,
      },
    });
  }

  async reject(userId: string, note: string | null): Promise<void> {
    await this.db().customer.update({
      where: { userId },
      data: {
        b2bStatus: "REJECTED",
        b2bNote: note,
        groupId: null,
        approvedAt: null,
      },
    });
  }

  async updateTerms(userId: string, input: DealerApprovalInput): Promise<void> {
    await this.db().customer.update({
      where: { userId },
      data: {
        groupId: input.groupId,
        creditLimit: input.creditLimit,
        minOrderAmount: input.minOrderAmount,
      },
    });
  }

  async outstandingDeferredTotal(userId: string): Promise<Decimal> {
    const result = await this.db().order.aggregate({
      where: {
        userId,
        paymentStatus: "PENDING",
        status: { notIn: ["CANCELLED", "REFUNDED", "PENDING_PAYMENT"] },
        payments: { some: { method: "DEFERRED" } },
      },
      _sum: { grandTotal: true },
    });
    return result._sum.grandTotal ?? new Decimal(0);
  }
}
