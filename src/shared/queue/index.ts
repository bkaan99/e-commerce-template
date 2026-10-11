import "server-only";
import { getEnv } from "../env";
import type { JobQueue } from "./job-queue";
import { PgBossJobQueue } from "./pg-boss-job-queue";

export type { JobQueue, JobHandler, EnqueueOptions } from "./job-queue";

const globalForQueue = globalThis as unknown as {
  jobQueue?: JobQueue;
  workerQueue?: JobQueue;
};

/** Web sürecinin kuyruğu: yalnızca iş ekler. */
export function getJobQueue(): JobQueue {
  globalForQueue.jobQueue ??= new PgBossJobQueue(getEnv().DATABASE_URL, {
    background: false,
  });
  return globalForQueue.jobQueue;
}

/** Worker sürecinin kuyruğu: işleri çalıştırır, zamanlar ve bakım yapar. */
export function getWorkerQueue(): JobQueue {
  globalForQueue.workerQueue ??= new PgBossJobQueue(getEnv().DATABASE_URL, {
    background: true,
  });
  return globalForQueue.workerQueue;
}
