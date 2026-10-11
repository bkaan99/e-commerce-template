import type { PrismaClient } from "@/shared/prisma-client";

export interface CouponView {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: string;
  minSubtotal: string | null;
  maxUses: number | null;
  perCustomerLimit: number | null;
  usedCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

export interface CampaignView {
  id: string;
  name: string;
  ruleType: string;
  config: unknown;
  priority: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

export interface CouponData {
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minSubtotal: number | null;
  maxUses: number | null;
  perCustomerLimit: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

export interface CampaignData {
  name: string;
  ruleType: string;
  config: object;
  priority: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

export interface PromotionRepository {
  listCoupons(): Promise<CouponView[]>;
  findCouponByCode(code: string): Promise<{ id: string } | null>;
  findCoupon(
    id: string,
  ): Promise<{ id: string; code: string; usedCount: number } | null>;
  createCoupon(data: CouponData): Promise<string>;
  updateCoupon(id: string, data: CouponData): Promise<void>;
  deleteCoupon(id: string): Promise<void>;
  listCampaigns(): Promise<CampaignView[]>;
  createCampaign(data: CampaignData): Promise<string>;
  updateCampaign(id: string, data: CampaignData): Promise<void>;
  deleteCampaign(id: string): Promise<void>;
}

export class PrismaPromotionRepository implements PromotionRepository {
  constructor(private readonly db: () => PrismaClient) {}

  async listCoupons(): Promise<CouponView[]> {
    const rows = await this.db().coupon.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      type: row.type,
      value: row.value.toFixed(2),
      minSubtotal: row.minSubtotal?.toFixed(2) ?? null,
      maxUses: row.maxUses,
      perCustomerLimit: row.perCustomerLimit,
      usedCount: row.usedCount,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      isActive: row.isActive,
    }));
  }

  findCouponByCode(code: string) {
    return this.db().coupon.findUnique({
      where: { code },
      select: { id: true },
    });
  }

  findCoupon(id: string) {
    return this.db().coupon.findUnique({
      where: { id },
      select: { id: true, code: true, usedCount: true },
    });
  }

  async createCoupon(data: CouponData): Promise<string> {
    const created = await this.db().coupon.create({
      data,
      select: { id: true },
    });
    return created.id;
  }

  async updateCoupon(id: string, data: CouponData): Promise<void> {
    await this.db().coupon.update({ where: { id }, data });
  }

  async deleteCoupon(id: string): Promise<void> {
    await this.db().coupon.delete({ where: { id } });
  }

  async listCampaigns(): Promise<CampaignView[]> {
    const rows = await this.db().campaign.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      ruleType: row.ruleType,
      config: row.config,
      priority: row.priority,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      isActive: row.isActive,
    }));
  }

  async createCampaign(data: CampaignData): Promise<string> {
    const created = await this.db().campaign.create({
      data,
      select: { id: true },
    });
    return created.id;
  }

  async updateCampaign(id: string, data: CampaignData): Promise<void> {
    await this.db().campaign.update({ where: { id }, data });
  }

  async deleteCampaign(id: string): Promise<void> {
    await this.db().campaign.delete({ where: { id } });
  }
}
