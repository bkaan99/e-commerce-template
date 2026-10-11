import { getAuditLogger } from "@/shared/audit";
import { getDb } from "@/shared/db";
import { getEventBus } from "@/shared/events";
import { getOrderService } from "../orders/container";
import { PrismaProductAdminRepository } from "./catalog/product-admin.repository";
import { ProductAdminService } from "./catalog/product-admin.service";
import { PrismaTaxonomyRepository } from "./taxonomy/taxonomy.repository";
import { TaxonomyService } from "./taxonomy/taxonomy.service";
import { PrismaAdminOrderRepository } from "./orders/admin-order.repository";
import { AdminOrderService } from "./orders/admin-order.service";

export function getAdminOrderService(): AdminOrderService {
  return new AdminOrderService(
    new PrismaAdminOrderRepository(getDb),
    getOrderService(),
    getEventBus(),
    getAuditLogger(),
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
