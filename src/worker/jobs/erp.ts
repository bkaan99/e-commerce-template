import { isFeatureEnabled } from "@/config/features";
import { getErpSyncService } from "@/modules/erp/container";
import { logger } from "@/shared/logger";
import type { JobQueue } from "@/shared/queue";

export const JOB_ERP_STOCK_SYNC = "erp.stock-sync";

/** ERP açıksa stok/fiyatı periyodik çeker. Hata durumunda kuyruk yeniden dener. */
export async function registerErpJobs(queue: JobQueue): Promise<void> {
  if (!isFeatureEnabled("erp")) return;

  await queue.process(JOB_ERP_STOCK_SYNC, async () => {
    const report = await getErpSyncService().syncStock();
    logger.info(report, "ERP stok senkronizasyonu tamamlandı");
  });

  await queue.schedule(JOB_ERP_STOCK_SYNC, "*/15 * * * *");
}
