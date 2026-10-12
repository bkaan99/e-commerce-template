import "dotenv/config";
import { logger } from "@/shared/logger";
import { getWorkerQueue } from "@/shared/queue";
import { registerEmailJobs } from "./jobs/email";
import { registerErpJobs } from "./jobs/erp";
import { registerMaintenanceJobs } from "./jobs/maintenance";
import { registerOrderJobs } from "./jobs/orders";
import { registerStockAlertJobs } from "./jobs/stock-alerts";

/** Arka plan işlerini işleyen ayrı süreç. Çalıştırmak için: npm run worker */
async function main(): Promise<void> {
  const queue = getWorkerQueue();

  await registerMaintenanceJobs(queue);
  await registerEmailJobs(queue);
  await registerOrderJobs(queue);
  await registerStockAlertJobs(queue);
  await registerErpJobs(queue);
  logger.info("Worker başlatıldı");

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Worker kapatılıyor");
    await queue.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  logger.error({ err: error }, "Worker başlatılamadı");
  process.exit(1);
});
