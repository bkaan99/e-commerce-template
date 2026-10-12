"use server";

import { getAdminOrderService } from "@/modules/admin/container";
import { runAdminAction, type AdminActionResult } from "@/modules/admin/action";
import { PERMISSIONS } from "@/shared/permissions";

const paths = (orderNumber: string) => [
  "/admin/siparisler",
  `/admin/siparisler/${orderNumber}`,
  "/admin",
];

export async function markProcessingAction(
  orderNumber: string,
): Promise<AdminActionResult> {
  return runAdminAction(
    PERMISSIONS.ORDER_UPDATE,
    (actor) => getAdminOrderService().markProcessing(orderNumber, actor),
    paths(orderNumber),
  );
}

export async function shipOrderAction(
  orderNumber: string,
  carrier: string,
  trackingNumber: string,
): Promise<AdminActionResult> {
  return runAdminAction(
    PERMISSIONS.ORDER_UPDATE,
    (actor) =>
      getAdminOrderService().ship(
        orderNumber,
        { carrier, trackingNumber: trackingNumber || null },
        actor,
      ),
    paths(orderNumber),
  );
}

export async function markDeliveredAction(
  orderNumber: string,
): Promise<AdminActionResult> {
  return runAdminAction(
    PERMISSIONS.ORDER_UPDATE,
    (actor) => getAdminOrderService().markDelivered(orderNumber, actor),
    paths(orderNumber),
  );
}

export async function cancelOrderByStaffAction(
  orderNumber: string,
): Promise<AdminActionResult> {
  return runAdminAction(
    PERMISSIONS.ORDER_CANCEL,
    (actor) => getAdminOrderService().cancel(orderNumber, actor),
    paths(orderNumber),
  );
}

export async function confirmBankTransferAction(
  orderNumber: string,
): Promise<AdminActionResult> {
  return runAdminAction(
    PERMISSIONS.ORDER_UPDATE,
    (actor) => getAdminOrderService().confirmBankTransfer(orderNumber, actor),
    paths(orderNumber),
  );
}

export async function markDeferredCollectedAction(
  orderNumber: string,
): Promise<AdminActionResult> {
  return runAdminAction(
    PERMISSIONS.ORDER_UPDATE,
    (actor) => getAdminOrderService().markDeferredCollected(orderNumber, actor),
    paths(orderNumber),
  );
}
