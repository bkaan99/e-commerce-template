import { z } from "zod";
import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors";
import type { AuditLogger } from "@/shared/audit/audit-logger";
import type { Actor } from "../admin/orders/admin-order.service";
import type { DealerRepository, GroupOption } from "./dealer.repository";
import type {
  DealerApplicationRow,
  DealerProfile,
  DealerStatus,
} from "./dealer.types";
import { isValidVkn } from "./vkn";

export const dealerApplicationSchema = z.object({
  companyName: z.string().trim().min(2, "Firma unvanı zorunlu").max(150),
  taxNumber: z
    .string()
    .trim()
    .refine(isValidVkn, "Geçerli bir 10 haneli vergi numarası girin"),
  taxOffice: z.string().trim().min(2, "Vergi dairesi zorunlu").max(100),
});

const optionalMoney = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined || value === "" || value === null) return null;
    const parsed = Number(String(value).replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      ctx.addIssue({ code: "custom", message: "Geçerli bir tutar girin" });
      return z.NEVER;
    }
    return parsed;
  });

export const dealerApprovalSchema = z.object({
  groupId: z.string().min(1, "Müşteri grubu seçin"),
  creditLimit: optionalMoney,
  minOrderAmount: optionalMoney,
});

export interface DealerMailer {
  sendDealerApplicationToAdmin(application: {
    companyName: string;
    taxNumber: string;
    email: string;
  }): Promise<void>;
  sendDealerDecision(
    email: string,
    approved: boolean,
    note: string | null,
  ): Promise<void>;
}

function firstIssue(error: { issues: readonly { message: string }[] }): string {
  return error.issues[0]?.message ?? "Geçersiz bilgi";
}

export class DealerService {
  constructor(
    private readonly dealers: DealerRepository,
    private readonly mailer: DealerMailer,
    private readonly audit: AuditLogger,
  ) {}

  getProfile(userId: string): Promise<DealerProfile | null> {
    return this.dealers.findProfile(userId);
  }

  async apply(userId: string, raw: unknown): Promise<void> {
    const parsed = dealerApplicationSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));

    const profile = await this.dealers.findProfile(userId);
    if (profile?.status === "PENDING") {
      throw new ConflictError("Başvurunuz inceleniyor");
    }
    if (profile?.status === "APPROVED") {
      throw new ConflictError("Zaten onaylı bir bayisiniz");
    }

    await this.dealers.apply(userId, parsed.data);

    const contact = await this.dealers.findContact(userId);
    if (contact) {
      await this.mailer.sendDealerApplicationToAdmin({
        companyName: parsed.data.companyName,
        taxNumber: parsed.data.taxNumber,
        email: contact.email,
      });
    }
  }

  list(filter: {
    status?: DealerStatus;
    search?: string;
  }): Promise<DealerApplicationRow[]> {
    return this.dealers.listApplications(filter);
  }

  listGroups(): Promise<GroupOption[]> {
    return this.dealers.listGroups();
  }

  async approve(userId: string, raw: unknown, actor: Actor): Promise<void> {
    const parsed = dealerApprovalSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));

    const profile = await this.requireProfile(userId);
    if (profile.status === "NONE") {
      throw new ConflictError("Bu kullanıcı bayi başvurusu yapmamış");
    }
    if (!(await this.dealers.groupExists(parsed.data.groupId))) {
      throw new ValidationError("Müşteri grubu bulunamadı");
    }

    await this.dealers.approve(userId, parsed.data);
    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "dealer.approve",
      entityType: "Customer",
      entityId: userId,
      before: { status: profile.status },
      after: { status: "APPROVED", ...parsed.data },
    });

    const contact = await this.dealers.findContact(userId);
    if (contact && profile.status !== "APPROVED") {
      await this.mailer.sendDealerDecision(contact.email, true, null);
    }
  }

  /** Onaylı bayinin grubunu, kredi limitini ve minimum sipariş tutarını günceller. */
  async updateTerms(userId: string, raw: unknown, actor: Actor): Promise<void> {
    const parsed = dealerApprovalSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));

    const profile = await this.requireProfile(userId);
    if (profile.status !== "APPROVED") {
      throw new ConflictError(
        "Yalnızca onaylı bayilerin koşulları güncellenebilir",
      );
    }
    if (!(await this.dealers.groupExists(parsed.data.groupId))) {
      throw new ValidationError("Müşteri grubu bulunamadı");
    }

    await this.dealers.updateTerms(userId, parsed.data);
    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "dealer.terms",
      entityType: "Customer",
      entityId: userId,
      before: {
        groupId: profile.groupId,
        creditLimit: profile.creditLimit,
        minOrderAmount: profile.minOrderAmount,
      },
      after: parsed.data,
    });
  }

  async reject(
    userId: string,
    note: string | null,
    actor: Actor,
  ): Promise<void> {
    const profile = await this.requireProfile(userId);
    if (profile.status === "NONE") {
      throw new ConflictError("Bu kullanıcı bayi başvurusu yapmamış");
    }

    const trimmed = note?.trim() || null;
    await this.dealers.reject(userId, trimmed);
    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "dealer.reject",
      entityType: "Customer",
      entityId: userId,
      before: { status: profile.status },
      after: { status: "REJECTED", note: trimmed },
    });

    const contact = await this.dealers.findContact(userId);
    if (contact)
      await this.mailer.sendDealerDecision(contact.email, false, trimmed);
  }

  private async requireProfile(userId: string): Promise<DealerProfile> {
    const profile = await this.dealers.findProfile(userId);
    if (!profile) throw new NotFoundError("Müşteri");
    return profile;
  }
}
