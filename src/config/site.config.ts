import { features, type Features } from "./features";
import { projectConfig } from "./project-config";

export type SalesMode = "retail" | "b2b" | "hybrid";

export interface SiteConfig {
  name: string;
  description: string;
  locale: "tr";
  currency: string;
  /**
   * retail: herkes perakende fiyatı görür.
   * hybrid: ziyaretçi perakende, onaylı bayi kendi fiyatını görür.
   * b2b: fiyatlar girişsiz gizlidir, üyelik onaya tabidir.
   */
  salesMode: SalesMode;
  contact: {
    email: string;
    phone: string;
  };
  returns: {
    /** Cayma hakkı süresi (gün). Mesafeli satışta yasal alt sınır 14 gündür. */
    withdrawalPeriodDays: number;
  };
  shipping: {
    /** Bu tutarın üzerindeki siparişlerde kargo ücretsiz */
    freeShippingThreshold: number;
    /** Desi tarifesi tanımlı değilse uygulanan sabit ücret */
    flatRate: number;
    /** Toplam desi ≤ maxDesi olan ilk kademenin ücreti uygulanır (artan sırada) */
    desiTariff: { maxDesi: number; price: number }[];
    /** Son kademeyi aşan her ek desi için eklenen ücret */
    extraDesiPrice: number;
    /** Kargo ücretinin KDV oranı (yüzde) */
    taxRate: number;
  };
  inventory: {
    /** Ödeme başlatıldığında stoğun rezerve tutulacağı süre */
    reservationMinutes: number;
    /** Bu adet ve altındaki stok "düşük stok" olarak raporlanır */
    lowStockThreshold: number;
  };
  auditLog: {
    retentionDays: number;
  };
  b2b: {
    /** Vadeli ödemede varsayılan vade (gün) */
    deferredPaymentDays: number;
    /** Havale/EFT siparişinde stoğun rezerve tutulacağı süre (saat) */
    bankTransferHoldHours: number;
    /** Havale/EFT seçeneğinde müşteriye gösterilen hesaplar; boşsa havale kapalıdır */
    bankAccounts: { bank: string; accountName: string; iban: string }[];
  };
}

const defaultSiteConfig: SiteConfig = {
  name: "E-Ticaret Şablonu",
  description: "Next.js tabanlı e-ticaret şablonu",
  locale: "tr",
  currency: "TRY",
  salesMode: "retail",
  contact: {
    email: "info@example.com",
    phone: "+90 000 000 00 00",
  },
  returns: {
    withdrawalPeriodDays: 14,
  },
  shipping: {
    freeShippingThreshold: 500,
    flatRate: 49.9,
    desiTariff: [],
    extraDesiPrice: 5,
    taxRate: 20,
  },
  inventory: {
    reservationMinutes: 15,
    lowStockThreshold: 5,
  },
  auditLog: {
    retentionDays: 365,
  },
  b2b: {
    deferredPaymentDays: 30,
    bankTransferHoldHours: 72,
    bankAccounts: [],
  },
};

const projectSite = projectConfig.site ?? {};

export const siteConfig: SiteConfig = {
  ...defaultSiteConfig,
  name: projectSite.name ?? defaultSiteConfig.name,
  description: projectSite.description ?? defaultSiteConfig.description,
  salesMode: projectSite.salesMode ?? defaultSiteConfig.salesMode,
  contact: { ...defaultSiteConfig.contact, ...projectSite.contact },
  b2b: { ...defaultSiteConfig.b2b, ...projectSite.b2b },
};

/** Yapılandırma tutarsızlıklarını açılışta yakalar. */
export function validateSiteConfig(
  config: SiteConfig = siteConfig,
  enabled: Features = features,
): void {
  if (config.salesMode !== "retail" && !enabled.b2b) {
    throw new Error(
      `salesMode "${config.salesMode}" için features.b2b açık olmalıdır`,
    );
  }

  if (config.returns.withdrawalPeriodDays < 14) {
    throw new Error("Cayma süresi yasal alt sınır olan 14 günden kısa olamaz");
  }
}

validateSiteConfig();
