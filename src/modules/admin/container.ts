import { getAuditLogger } from "@/shared/audit";
import { getDb } from "@/shared/db";
import { getEventBus } from "@/shared/events";
import { getOrderService, orderRepository } from "../orders/container";
import { PrismaProductAdminRepository } from "./catalog/product-admin.repository";
import { ProductAdminService } from "./catalog/product-admin.service";
import { PrismaTaxonomyRepository } from "./taxonomy/taxonomy.repository";
import { TaxonomyService } from "./taxonomy/taxonomy.service";
import { PrismaPromotionRepository } from "./promotions/promotion.repository";
import { PromotionService } from "./promotions/promotion.service";
import { AuditQueryService } from "./audit/audit-query";
import { CustomerQueryService } from "./customers/customer-query";
import { PrismaPriceListRepository } from "./pricing/price-list.repository";
import { PriceListService } from "./pricing/price-list.service";
import { PrismaAdminOrderRepository } from "./orders/admin-order.repository";
import { AdminOrderService } from "./orders/admin-order.service";
import { PrismaBulkUpdateRepository } from "./import/bulk-update.repository";
import { BulkUpdateService } from "./import/bulk-update.service";
import { PrismaImportRepository } from "./import/import.repository";
import { ProductImportService } from "./import/product-import.service";
import { getAccountService } from "../account/container";
import { PrismaStaffRepository } from "./staff/staff.repository";
import { StaffService } from "./staff/staff.service";

export function getAdminOrderService(): AdminOrderService {
  return new AdminOrderService(
    new PrismaAdminOrderRepository(getDb),
    getOrderService(),
    getEventBus(),
    getAuditLogger(),
    orderRepository,
  );
}

export function getProductAdminService(): ProductAdminService {
  return new ProductAdminService(
    new PrismaProductAdminRepository(getDb),
    getEventBus(),
    getAuditLogger(),
  );
}

export function getTaxonomyService(): TaxonomyService {
  return new TaxonomyService(
    new PrismaTaxonomyRepository(getDb),
    getAuditLogger(),
  );
}

export function getPromotionService(): PromotionService {
  return new PromotionService(
    new PrismaPromotionRepository(getDb),
    getAuditLogger(),
  );
}

export function getAuditQueryService(): AuditQueryService {
  return new AuditQueryService(getDb);
}

export function getCustomerQueryService(): CustomerQueryService {
  return new CustomerQueryService(getDb);
}

export function getPriceListService(): PriceListService {
  return new PriceListService(
    new PrismaPriceListRepository(getDb),
    getAuditLogger(),
  );
}

export function getBulkUpdateService(): BulkUpdateService {
  return new BulkUpdateService(
    new PrismaBulkUpdateRepository(getDb),
    getEventBus(),
    getAuditLogger(),
  );
}

export function getProductImportService(): ProductImportService {
  return new ProductImportService(
    getProductAdminService(),
    new PrismaImportRepository(getDb),
  );
}

export function getStaffService(): StaffService {
  return new StaffService(
    new PrismaStaffRepository(getDb),
    {
      // Parola belirleme bağlantısı, parola sıfırlama akışıyla gönderilir.
      sendPasswordSetup: (email) =>
        getAccountService().requestPasswordReset(email),
    },
    getAuditLogger(),
  );
}
