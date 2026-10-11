import { getStockAlertService } from "@/modules/stock-alerts/container";
import { logger } from "@/shared/logger";
import type { JobQueue } from "@/shared/queue";

export const JOB_STOCK_ALERT_SWEEP = "stock-alerts.sweep";

/** Stoğa giren varyantların bekleyen abonelerine bildirim gönderir. */
export async function registerStockAlertJobs(queue: JobQueue): Promise<void> {
  await queue.process(JOB_STOCK_ALERT_SWEEP, async () => {
    const notified = await getStockAlertService().notifyAvailable();
    if (notified > 0) {
      logger.info({ notified }, "Stok bildirimleri gönderildi");
    }
  });

  await queue.schedule(JOB_STOCK_ALERT_SWEEP, "*/10 * * * *");
}
