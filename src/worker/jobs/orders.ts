import { orderRepository } from "@/modules/orders/container";
import { logger } from "@/shared/logger";
import type { JobQueue } from "@/shared/queue";

export const JOB_RELEASE_EXPIRED_ORDERS = "orders.release-expired";

/** Ödeme süresi dolan siparişleri iptal eder ve rezerve stoğu serbest bırakır. */
export async function registerOrderJobs(queue: JobQueue): Promise<void> {
  await queue.process(JOB_RELEASE_EXPIRED_ORDERS, async () => {
    const released = await orderRepository.releaseExpired(new Date());
    if (released > 0) {
      logger.info({ released }, "Süresi dolan siparişler iptal edildi");
    }
  });

  await queue.schedule(JOB_RELEASE_EXPIRED_ORDERS, "*/5 * * * *");
}
