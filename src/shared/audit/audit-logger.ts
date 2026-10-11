export interface AuditEntry {
  actorId: string | null;
  /** Örn. "product.price.update", "order.refund" */
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

/** Denetim kaydı yalnızca eklenir; güncelleme ve tekil silme yoktur. */
export interface AuditLogger {
  log(entry: AuditEntry): Promise<void>;
  /** Saklama süresi dolan kayıtları toplu siler. */
  purgeOlderThan(cutoff: Date): Promise<number>;
}
