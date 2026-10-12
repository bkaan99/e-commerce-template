/** Dosya depolama arayüzü; yerel disk dışında (S3, R2 vb.) bir adaptör eklenebilir. */
export interface StoredFile {
  data: Buffer;
  contentType: string;
}

export interface FileStorage {
  /** Dosyayı kaydeder ve herkese açık adresini döndürür. */
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  read(key: string): Promise<StoredFile | null>;
  remove(key: string): Promise<void>;
}

/** Kaydedilen dosyanın anahtarı: kapsam + rastgele ad (tahmin edilemez, değişmez). */
export const STORAGE_KEY_PATTERN =
  /^[a-z0-9-]{1,40}\/[a-f0-9-]{36}\.(jpg|png|webp|gif)$/;
