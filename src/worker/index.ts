import "dotenv/config";
import { logger } from "@/shared/logger";
import { getJobQueue } from "@/shared/queue";
import { registerMaintenanceJobs } from "./jobs/maintenance";

/** Arka plan işlerini işleyen ayrı süreç. Çalıştırmak için: npm run worker */
async function main(): Promise<void> {
  const queue = getJobQueue();

  await registerMaintenanceJobs(queue);
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
