import { features, type Features } from "./features";

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
    flatRate: number;
  };
  inventory: {
    /** Ödeme başlatıldığında stoğun rezerve tutulacağı süre */
    reservationMinutes: number;
  };
  auditLog: {
    retentionDays: number;
  };
}

export const siteConfig: SiteConfig = {
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
  },
  inventory: {
    reservationMinutes: 15,
  },
  auditLog: {
    retentionDays: 365,
  },
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
