export interface RowIssue {
  /** Dosyadaki satır numarası (başlık = 1) */
  row: number;
  message: string;
}

export interface BulkUpdateReport {
  dryRun: boolean;
  total: number;
  updated: number;
  issues: RowIssue[];
}

export interface ProductImportReport {
  dryRun: boolean;
  totalRows: number;
  products: number;
  created: number;
  issues: RowIssue[];
}

/** Dosya çok büyükse bellek ve süre güvenliği için reddedilir. */
export const MAX_IMPORT_ROWS = 5000;
