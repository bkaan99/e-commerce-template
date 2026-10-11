import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors";
import type { AuditLogger } from "@/shared/audit/audit-logger";
import type { Actor } from "../orders/admin-order.service";
import type {
  CampaignView,
  CouponView,
  PromotionRepository,
} from "./promotion.repository";
import {
  campaignConfig,
  campaignInputSchema,
  couponInputSchema,
} from "./promotion.schema";

export type { CampaignView, CouponView };

function firstIssue(error: { issues: readonly { message: string }[] }): string {
  return error.issues[0]?.message ?? "Geçersiz bilgi";
}

export class PromotionService {
  constructor(
    private readonly repository: PromotionRepository,
    private readonly audit: AuditLogger,
  ) {}

  listCoupons(): Promise<CouponView[]> {
    return this.repository.listCoupons();
  }

  listCampaigns(): Promise<CampaignView[]> {
    return this.repository.listCampaigns();
  }

  async saveCoupon(
    id: string | null,
    raw: unknown,
    actor: Actor,
  ): Promise<void> {
    const parsed = couponInputSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));
    const input = parsed.data;

    const duplicate = await this.repository.findCouponByCode(input.code);
    if (duplicate && duplicate.id !== id) {
      throw new ConflictError("Bu kupon kodu zaten kullanılıyor");
    }

    let savedId: string;
    if (id) {
      await this.repository.updateCoupon(id, input);
      savedId = id;
    } else {
      savedId = await this.repository.createCoupon(input);
    }

    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: id ? "coupon.update" : "coupon.create",
      entityType: "Coupon",
      entityId: savedId,
      after: {
        code: input.code,
        type: input.type,
        value: input.value,
        active: input.isActive,
      },
    });
  }

  async deleteCoupon(id: string, actor: Actor): Promise<void> {
    const coupon = await this.repository.findCoupon(id);
    if (!coupon) throw new NotFoundError("Kupon");
    if (coupon.usedCount > 0) {
      throw new ConflictError("Kullanılmış kupon silinemez; pasife alın");
    }

    await this.repository.deleteCoupon(id);
    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "coupon.delete",
      entityType: "Coupon",
      entityId: id,
      before: { code: coupon.code },
    });
  }

  async saveCampaign(
    id: string | null,
    raw: unknown,
    actor: Actor,
  ): Promise<void> {
    const parsed = campaignInputSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));
    const input = parsed.data;

    const data = {
      name: input.name,
      ruleType: input.ruleType,
      config: campaignConfig(input),
      priority: input.priority,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      isActive: input.isActive,
    };

    let savedId: string;
    if (id) {
      await this.repository.updateCampaign(id, data);
      savedId = id;
    } else {
      savedId = await this.repository.createCampaign(data);
    }

    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: id ? "campaign.update" : "campaign.create",
      entityType: "Campaign",
      entityId: savedId,
      after: {
        name: input.name,
        ruleType: input.ruleType,
        active: input.isActive,
      },
    });
  }

  async deleteCampaign(id: string, actor: Actor): Promise<void> {
    await this.repository.deleteCampaign(id);
    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "campaign.delete",
      entityType: "Campaign",
      entityId: id,
    });
  }
}
