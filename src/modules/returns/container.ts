import { siteConfig } from "@/config/site.config";
import { getAuditLogger } from "@/shared/audit";
import { getDb } from "@/shared/db";
import {
  getNotificationService,
  getOrderService,
  getPaymentProvider,
} from "../orders/container";
import { PrismaReturnRepository } from "./return.repository";
import { ReturnService } from "./return.service";

export function getReturnService(): ReturnService {
  return new ReturnService({
    returns: new PrismaReturnRepository(getDb),
    orderAccess: getOrderService(),
    refunder: getPaymentProvider(),
    audit: getAuditLogger(),
    notifier: getNotificationService(),
    withdrawalPeriodDays: siteConfig.returns.withdrawalPeriodDays,
  });
}
