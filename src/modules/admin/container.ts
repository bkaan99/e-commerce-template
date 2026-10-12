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
