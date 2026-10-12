/**
 * Desteklenen kargo firmaları ve takip bağlantıları. Takip adresleri firmaların
 * sitelerindeki güncel biçime göre zaman zaman değişebilir; gerekirse burada
 * güncelleyin. Listede olmayan firmalar için bağlantı üretilmez.
 */
export interface Carrier {
  name: string;
  /** {no} yerine takip numarası (URL-encode edilmiş) yazılır. */
  trackingUrlTemplate?: string;
}

export const CARRIERS: readonly Carrier[] = [
  {
    name: "Yurtiçi Kargo",
    trackingUrlTemplate:
      "https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code={no}",
  },
  {
    name: "Aras Kargo",
    trackingUrlTemplate:
      "https://kargotakip.araskargo.com.tr/mainpage.aspx?code={no}",
  },
  {
    name: "MNG Kargo",
    trackingUrlTemplate: "https://www.mngkargo.com.tr/gonderi-takip/{no}",
  },
  {
    name: "PTT Kargo",
    trackingUrlTemplate: "https://gonderitakip.ptt.gov.tr/Track/Verify?q={no}",
  },
  {
    name: "Sürat Kargo",
    trackingUrlTemplate:
      "https://www.suratkargo.com.tr/KargoTakip/?kargotakipno={no}",
  },
  { name: "Diğer" },
];

export const CARRIER_NAMES: readonly string[] = CARRIERS.map((c) => c.name);

/** Takip numarası ve firma için takip bağlantısı; üretilemiyorsa null. */
export function trackingUrl(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined,
): string | null {
  const number = trackingNumber?.trim();
  if (!carrier || !number) return null;

  const template = CARRIERS.find(
    (c) => c.name === carrier,
  )?.trackingUrlTemplate;
  if (!template) return null;

  return template.replace("{no}", encodeURIComponent(number));
}
