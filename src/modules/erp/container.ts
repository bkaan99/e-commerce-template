import { getAuditLogger } from "@/shared/audit";
import { getDb } from "@/shared/db";
import { getEnv } from "@/shared/env";
import { getEventBus } from "@/shared/events";
import { PrismaBulkUpdateRepository } from "../admin/import/bulk-update.repository";
import { ErpSyncService } from "./erp-sync.service";
import { HttpJsonErpConnector } from "./http-erp-connector";

/**
 * Bağlayıcının seçildiği tek yer. Müşterinin ERP'si farklıysa
 * `ErpConnector` arayüzünü uygulayan sınıfı buraya bağlayın.
 */
export function getErpSyncService(): ErpSyncService {
  const env = getEnv();
  if (!env.ERP_STOCK_URL) {
    throw new Error("ERP_STOCK_URL tanımlı değil");
  }

  return new ErpSyncService(
    new HttpJsonErpConnector(env.ERP_STOCK_URL, env.ERP_API_KEY),
    new PrismaBulkUpdateRepository(getDb),
    getEventBus(),
    getAuditLogger(),
  );
}
