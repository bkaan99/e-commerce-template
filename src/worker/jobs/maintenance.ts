import { siteConfig } from "@/config/site.config";
import { getAuditLogger } from "@/shared/audit";
import { logger } from "@/shared/logger";
import type { JobQueue } from "@/shared/queue";
import { getRateLimiter } from "@/shared/rate-limit";

export const JOB_PURGE_RATE_LIMITS = "maintenance.purge-rate-limits";
export const JOB_PURGE_AUDIT_LOG = "maintenance.purge-audit-log";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function registerMaintenanceJobs(queue: JobQueue): Promise<void> {
  await queue.process(JOB_PURGE_RATE_LIMITS, async () => {
    const removed = await getRateLimiter().purgeExpired(
      new Date(Date.now() - DAY_MS),
    );
    logger.info({ removed }, "Rate limit kayıtları temizlendi");
  });

  await queue.process(JOB_PURGE_AUDIT_LOG, async () => {
    const cutoff = new Date(
      Date.now() - siteConfig.auditLog.retentionDays * DAY_MS,
    );
    const removed = await getAuditLogger().purgeOlderThan(cutoff);
    logger.info({ removed }, "Süresi dolan denetim kayıtları silindi");
  });

  await queue.schedule(JOB_PURGE_RATE_LIMITS, "0 * * * *");
  await queue.schedule(JOB_PURGE_AUDIT_LOG, "30 3 * * *");
}
