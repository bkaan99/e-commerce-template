/** Yasal metin sayfaları: slug'lar sabittir; içerik admin panelinden düzenlenir. */
export const LEGAL_PAGES = [
  { slug: "mesafeli-satis-sozlesmesi", title: "Mesafeli Satış Sözleşmesi" },
  { slug: "on-bilgilendirme-formu", title: "Ön Bilgilendirme Formu" },
  { slug: "kvkk-aydinlatma-metni", title: "KVKK Aydınlatma Metni" },
  { slug: "iade-ve-iptal-kosullari", title: "İade ve İptal Koşulları" },
  { slug: "cerez-politikasi", title: "Çerez Politikası" },
] as const;

export type LegalSlug = (typeof LEGAL_PAGES)[number]["slug"];

/** Yayında olan yasal sayfaları sabit sırayla döndürür. */
export function publishedLegalLinks(
  publishedSlugs: readonly string[],
): { slug: LegalSlug; title: string; href: string }[] {
  const published = new Set(publishedSlugs);

  return LEGAL_PAGES.filter((page) => published.has(page.slug)).map((page) => ({
    slug: page.slug,
    title: page.title,
    href: `/sayfa/${page.slug}`,
  }));
}
