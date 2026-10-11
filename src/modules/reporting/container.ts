import { siteConfig } from "@/config/site.config";
import { getDb } from "@/shared/db";
import { PrismaReportingRepository } from "./reporting.repository";
import { ReportingService } from "./reporting.service";

export const reportingService = new ReportingService(
  new PrismaReportingRepository(getDb),
  siteConfig.inventory.lowStockThreshold,
);
