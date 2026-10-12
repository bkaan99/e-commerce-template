import { projectConfig } from "./project-config";

/**
 * Özellik bayrakları. Müşteri projesinde ihtiyaca göre açılıp kapatılır.
 * Kapalı bir özelliğin modülü ve menüleri uygulamada görünmez.
 */
export interface Features {
  /** B2B bayi/toptan satış (müşteri grupları, fiyat listeleri, onaylı üyelik) */
  b2b: boolean;
  /** Üyeliksiz sipariş verebilme */
  guestCheckout: boolean;
  /** Favoriler */
  wishlist: boolean;
  /** Blog */
  blog: boolean;
  /** SMS bildirimleri (sağlayıcı adapter'ı gerektirir) */
  sms: boolean;
  /** Cloudflare Turnstile ile bot koruması */
  captcha: boolean;
  /** ERP ile zamanlanmış stok/fiyat senkronizasyonu (bağlayıcı gerektirir) */
  erp: boolean;
}

const defaultFeatures: Features = {
  b2b: false,
  guestCheckout: true,
  wishlist: true,
  blog: false,
  sms: false,
  captcha: false,
  erp: false,
};

export const features: Features = {
  ...defaultFeatures,
  ...projectConfig.features,
};

export function isFeatureEnabled(name: keyof Features): boolean {
  return features[name];
}
