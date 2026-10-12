/**
 * Yasal metin ŞABLONLARI. İçerikler genel bir başlangıç noktasıdır ve hukuk
 * danışmanı tarafından firmanıza göre uyarlanmadan yayınlanmamalıdır. Seed bu
 * sayfaları TASLAK olarak oluşturur; yönetim panelinden düzenleyip yayınlayın.
 */
const NOTICE =
  "**ŞABLON METİN:** Bu metin örnek amaçlıdır. Yayınlamadan önce hukuk danışmanınızla gözden geçirin ve [köşeli parantezli] alanları doldurun.";

export const LEGAL_PAGE_TEMPLATES: {
  slug: string;
  title: string;
  content: string;
}[] = [
  {
    slug: "mesafeli-satis-sozlesmesi",
    title: "Mesafeli Satış Sözleşmesi",
    content: `${NOTICE}

# Taraflar

**Satıcı:** [Firma ünvanı], [Adres], [Vergi dairesi / VKN], [E-posta], [Telefon]

**Alıcı:** Sipariş sırasında bilgileri girilen kişi.

# Konu

İşbu sözleşmenin konusu, alıcının satıcıya ait internet sitesinden elektronik ortamda sipariş verdiği ürünlerin satışı ve teslimine ilişkin tarafların hak ve yükümlülükleridir.

# Ürün ve ödeme bilgileri

Ürünün temel nitelikleri, KDV dahil satış fiyatı, ödeme şekli ve teslimat bilgileri sipariş özetinde yer alır.

# Teslimat

Ürünler, sipariş onayından sonra [teslimat süresi] iş günü içinde alıcının belirttiği adrese kargo ile teslim edilir.

# Cayma hakkı

Alıcı, ürünün tesliminden itibaren **14 gün** içinde herhangi bir gerekçe göstermeksizin cayma hakkını kullanabilir. Cayma bildirimi ve iade koşulları için [İade ve İptal Koşulları](/sayfa/iade-ve-iptal-kosullari) sayfasına bakınız.

# Uyuşmazlıkların çözümü

Uyuşmazlıklarda Ticaret Bakanlığınca ilan edilen değere kadar Tüketici Hakem Heyetleri, bu değerin üzerinde Tüketici Mahkemeleri yetkilidir.`,
  },
  {
    slug: "on-bilgilendirme-formu",
    title: "Ön Bilgilendirme Formu",
    content: `${NOTICE}

# Satıcı bilgileri

[Firma ünvanı] · [Adres] · [E-posta] · [Telefon]

# Ürün bilgileri

Sipariş edilen ürünlerin adı, adedi, KDV dahil fiyatı ve kargo bedeli sipariş özetinde gösterilir.

# Ödeme ve teslimat

Ödeme yöntemleri ödeme adımında sunulur. Teslimat süresi ve kargo firması sipariş sonrası e-posta ile bildirilir.

# Cayma hakkı

Tüketici, teslim tarihinden itibaren 14 gün içinde cayma hakkını kullanabilir. Cayma hakkının kullanılamayacağı ürünler yönetmelikte belirtilen istisnalarla sınırlıdır.`,
  },
  {
    slug: "kvkk-aydinlatma-metni",
    title: "KVKK Aydınlatma Metni",
    content: `${NOTICE}

# Veri sorumlusu

[Firma ünvanı] (“Şirket”), 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında veri sorumlusudur.

# İşlenen kişisel veriler

Ad, soyad, iletişim bilgileri, teslimat ve fatura adresi, sipariş ve ödeme bilgileri, işlem güvenliği verileri.

# İşleme amaçları

Siparişlerin alınması ve teslimi, faturalandırma, yasal yükümlülüklerin yerine getirilmesi, müşteri iletişimi ve talep yönetimi.

# Aktarım

Kişisel veriler; kargo firmaları, ödeme kuruluşları ve yasal olarak yetkili kurumlarla, amaçla sınırlı olarak paylaşılır.

# Haklarınız

KVKK madde 11 kapsamındaki haklarınızı [e-posta] adresine başvurarak veya hesap ayarlarınızdan verilerinizi indirerek/hesabınızı silerek kullanabilirsiniz.`,
  },
  {
    slug: "iade-ve-iptal-kosullari",
    title: "İade ve İptal Koşulları",
    content: `${NOTICE}

# Sipariş iptali

Kargoya verilmemiş siparişler hesabınızdaki sipariş sayfasından iptal edilebilir. Ödenmiş siparişlerde tutar, ödeme yaptığınız yönteme iade edilir.

# İade

Teslimden itibaren 14 gün içinde ürünü kullanılmamış ve ambalajı bozulmamış şekilde iade edebilirsiniz. İade talebini sipariş sayfasından oluşturabilirsiniz.

# İade bedeli

Talebiniz onaylandıktan sonra ürün bedeli ödeme yönteminize iade edilir. Bankanıza bağlı olarak hesabınıza yansıması birkaç iş günü sürebilir.

# İade edilemeyen ürünler

[İade kapsamı dışındaki ürün grupları]`,
  },
  {
    slug: "cerez-politikasi",
    title: "Çerez Politikası",
    content: `${NOTICE}

# Çerez nedir?

Çerezler, siteyi ziyaret ettiğinizde cihazınıza kaydedilen küçük metin dosyalarıdır.

# Kullandığımız çerezler

- **Zorunlu çerezler:** oturum, sepet ve güvenlik için gereklidir.
- **Analitik ve pazarlama çerezleri:** yalnızca onayınızla yüklenir; ziyaret istatistikleri ve reklam ölçümü için kullanılır.

# Tercihlerinizi yönetme

Çerez tercihinizi sitedeki çerez bandından değiştirebilir veya tarayıcı ayarlarınızdan çerezleri silebilirsiniz.`,
  },
];
