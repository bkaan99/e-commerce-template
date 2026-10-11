import { PgBoss } from "pg-boss";
import { logger } from "../logger";
import type { EnqueueOptions, JobHandler, JobQueue } from "./job-queue";

export class PgBossJobQueue implements JobQueue {
  private readonly boss: PgBoss;
  private started: Promise<void> | undefined;
  private readonly knownQueues = new Set<string>();

  /**
   * `background: false` (web süreci) yalnızca iş ekler; zamanlama ve bakım
   * (supervise) görevlerini worker süreci yürütür.
   */
  constructor(
    connectionString: string,
    options: { background: boolean } = { background: true },
  ) {
    this.boss = new PgBoss({
      connectionString,
      schedule: options.background,
      supervise: options.background,
    });
    this.boss.on("error", (error) => {
      logger.error({ err: error }, "pg-boss hatası");
    });
  }

  private start(): Promise<void> {
    this.started ??= this.boss.start().then(() => undefined);
    return this.started;
  }

  private async ensureQueue(name: string): Promise<void> {
    await this.start();
    if (this.knownQueues.has(name)) return;
    await this.boss.createQueue(name);
    this.knownQueues.add(name);
  }

  async enqueue<T extends object>(
    name: string,
    data: T,
    options: EnqueueOptions = {},
  ): Promise<string | null> {
    await this.ensureQueue(name);
    // pg-boss, değeri undefined olan seçenek anahtarlarını reddeder.
    const sendOptions: Record<string, number | string> = {};
    if (options.delaySeconds !== undefined) {
      sendOptions["startAfter"] = options.delaySeconds;
    }
    if (options.retryLimit !== undefined) {
      sendOptions["retryLimit"] = options.retryLimit;
    }
    if (options.singletonKey !== undefined) {
      sendOptions["singletonKey"] = options.singletonKey;
    }

    return this.boss.send(name, data, sendOptions);
  }

  async process<T extends object>(
    name: string,
    handler: JobHandler<T>,
  ): Promise<void> {
    await this.ensureQueue(name);
    await this.boss.work<T>(name, async (jobs) => {
      for (const job of jobs) {
        await handler(job.data);
      }
    });
  }

  async schedule(name: string, cron: string): Promise<void> {
    await this.ensureQueue(name);
    await this.boss.schedule(name, cron);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.start();
      await this.boss.getQueues();
      return true;
    } catch {
      return false;
    }
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    await this.boss.stop();
    this.started = undefined;
    this.knownQueues.clear();
  }
}
