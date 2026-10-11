import "server-only";
import { getEnv } from "../env";
import type { JobQueue } from "./job-queue";
import { PgBossJobQueue } from "./pg-boss-job-queue";

export type { JobQueue, JobHandler, EnqueueOptions } from "./job-queue";

const globalForQueue = globalThis as unknown as { jobQueue?: JobQueue };

export function getJobQueue(): JobQueue {
  globalForQueue.jobQueue ??= new PgBossJobQueue(getEnv().DATABASE_URL);
  return globalForQueue.jobQueue;
}
