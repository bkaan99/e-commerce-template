import type { Prisma } from "../../../../generated/prisma/client";
import type { PrismaClient } from "@/shared/prisma-client";

export interface AuditQuery {
  action?: string;
  entityType?: string;
  actorId?: string;
  page: number;
  pageSize: number;
}

export interface AuditRow {
  id: string;
  createdAt: Date;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
}

export interface AuditPage {
  items: AuditRow[];
  total: number;
  page: number;
  totalPages: number;
  entityTypes: string[];
}

/** Denetim günlüğü okuma modeli: yalnızca sorgular, yazma `AuditLogger`dadır. */
export class AuditQueryService {
  constructor(private readonly db: () => PrismaClient) {}

  async search(query: AuditQuery): Promise<AuditPage> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.action
        ? { action: { contains: query.action, mode: "insensitive" } }
        : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
    };

    const [total, rows, types] = await Promise.all([
      this.db().auditLog.count({ where }),
      this.db().auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          actor: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      this.db().auditLog.findMany({
        distinct: ["entityType"],
        select: { entityType: true },
        orderBy: { entityType: "asc" },
      }),
    ]);

    return {
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      entityTypes: types.map((row) => row.entityType),
      items: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        actorName: row.actor
          ? `${row.actor.firstName} ${row.actor.lastName}`.trim()
          : null,
        actorEmail: row.actor?.email ?? null,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        before: row.before,
        after: row.after,
        ip: row.ip,
      })),
    };
  }
}
