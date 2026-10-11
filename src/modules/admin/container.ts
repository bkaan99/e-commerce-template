import { getAuditLogger } from "@/shared/audit";
import { getDb } from "@/shared/db";
import { getEventBus } from "@/shared/events";
import { getOrderService } from "../orders/container";
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
