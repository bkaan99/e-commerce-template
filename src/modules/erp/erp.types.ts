/** ERP'den gelen bir varyantın güncel stok ve (varsa) fiyat bilgisi. */
export interface ErpStockRecord {
  sku: string;
  stockQuantity: number;
  /** Verilirse satış fiyatı da güncellenir (örn. "129.90") */
  price?: string;
}

/**
 * ERP bağlayıcı sözleşmesi. Her müşteri projesi kendi ERP'si için bu arayüzü
 * uygular; senkronizasyon servisi ve zamanlanmış iş bağlayıcıdan bağımsızdır.
 */
export interface ErpConnector {
  readonly name: string;
  fetchStock(): Promise<ErpStockRecord[]>;
}

export interface ErpSyncReport {
  fetched: number;
  updated: number;
  /** Mağazada karşılığı olmayan SKU sayısı */
  unknown: number;
  /** Geçersiz kayıt (negatif stok, bozuk fiyat vb.) sayısı */
  invalid: number;
}
