export interface EnqueueOptions {
  /** İşin başlamasından önce beklenecek süre (saniye) */
  delaySeconds?: number;
  /** Başarısız işin kaç kez daha deneneceği */
  retryLimit?: number;
  /** Aynı anahtarla bekleyen tek iş bulunur; tekrarları engeller */
  singletonKey?: string;
}

export type JobHandler<T> = (data: T) => Promise<void>;

/** Arka plan iş kuyruğu sözleşmesi. Servisler yalnızca bu arayüze bağımlıdır. */
export interface JobQueue {
  enqueue<T extends object>(
    name: string,
    data: T,
    options?: EnqueueOptions,
  ): Promise<string | null>;
  process<T extends object>(
    name: string,
    handler: JobHandler<T>,
  ): Promise<void>;
  /** Cron ifadesiyle (UTC) tekrarlayan iş tanımlar. */
  schedule(name: string, cron: string): Promise<void>;
  healthCheck(): Promise<boolean>;
  stop(): Promise<void>;
}
