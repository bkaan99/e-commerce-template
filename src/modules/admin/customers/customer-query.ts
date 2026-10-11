import type { Prisma } from "../../../../generated/prisma/client";
import type { PrismaClient } from "@/shared/prisma-client";

export interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  emailVerified: boolean;
  isActive: boolean;
  orderCount: number;
  totalSpent: string;
  createdAt: Date;
}

export interface CustomerDetail extends CustomerRow {
  b2bStatus: string;
  companyName: string | null;
  groupName: string | null;
  orders: {
    orderNumber: string;
    status: string;
    grandTotal: string;
    createdAt: Date;
  }[];
}

export interface CustomerPage {
  items: CustomerRow[];
  total: number;
  page: number;
  totalPages: number;
}

const PAID_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

/** Müşteri okuma modeli (yönetim panelinde yalnızca görüntüleme). */
export class CustomerQueryService {
  constructor(private readonly db: () => PrismaClient) {}

  async search(query: {
    search?: string;
    page: number;
    pageSize: number;
  }): Promise<CustomerPage> {
    const term = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      type: "CUSTOMER",
      anonymizedAt: null,
      ...(term
        ? {
            OR: [
              { email: { contains: term, mode: "insensitive" } },
              { firstName: { contains: term, mode: "insensitive" } },
              { lastName: { contains: term, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, users] = await Promise.all([
      this.db().user.count({ where }),
      this.db().user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const stats = await this.statsFor(users.map((user) => user.id));

    return {
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      items: users.map((user) => ({
        id: user.id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        phone: user.phone,
        emailVerified: user.emailVerifiedAt !== null,
        isActive: user.isActive,
        orderCount: stats.get(user.id)?.count ?? 0,
        totalSpent: stats.get(user.id)?.total ?? "0.00",
        createdAt: user.createdAt,
      })),
    };
  }

  async get(id: string): Promise<CustomerDetail | null> {
    const user = await this.db().user.findFirst({
      where: { id, type: "CUSTOMER" },
      include: {
        customer: { include: { group: { select: { name: true } } } },
        orders: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    if (!user) return null;

    const stats = await this.statsFor([user.id]);

    return {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      phone: user.phone,
      emailVerified: user.emailVerifiedAt !== null,
      isActive: user.isActive,
      orderCount: stats.get(user.id)?.count ?? 0,
      totalSpent: stats.get(user.id)?.total ?? "0.00",
      createdAt: user.createdAt,
      b2bStatus: user.customer?.b2bStatus ?? "NONE",
      companyName: user.customer?.companyName ?? null,
      groupName: user.customer?.group?.name ?? null,
      orders: user.orders.map((order) => ({
        orderNumber: order.orderNumber,
        status: order.status,
        grandTotal: order.grandTotal.toFixed(2),
        createdAt: order.createdAt,
      })),
    };
  }

  private async statsFor(
    userIds: string[],
  ): Promise<Map<string, { count: number; total: string }>> {
    if (userIds.length === 0) return new Map();

    const grouped = await this.db().order.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, status: { in: [...PAID_STATUSES] } },
      _count: { _all: true },
      _sum: { grandTotal: true },
    });

    return new Map(
      grouped.flatMap((row) =>
        row.userId
          ? [
              [
                row.userId,
                {
                  count: row._count._all,
                  total: (row._sum.grandTotal ?? 0).toString(),
                },
              ] as const,
            ]
          : [],
      ),
    );
  }
}
