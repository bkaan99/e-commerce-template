import { getDb } from "@/shared/db";
import { getEnv } from "@/shared/env";
import { getSiteUrl } from "@/shared/site-url";
import { getNotificationService } from "../orders/container";
import { PrismaStockAlertRepository } from "./stock-alert.repository";
import { StockAlertService } from "./stock-alert.service";

export function getStockAlertService(): StockAlertService {
  return new StockAlertService({
    alerts: new PrismaStockAlertRepository(getDb),
    mailer: getNotificationService(),
    secret: getEnv().AUTH_SECRET,
    baseUrl: getSiteUrl(),
  });
}
