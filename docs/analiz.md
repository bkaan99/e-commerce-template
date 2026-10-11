# E-Ticaret Şablonu: Analiz ve Mimari Plan

> Durum: **v0.1 İskelet tamamlandı** (dal: `phase/v0.1-skeleton`, inceleme bekliyor). Sonraki fazlara yalnızca proje sahibinin açık "başla" demesiyle geçilir.
> Son güncelleme: 2026-10-11

## 1. Amaç

Türkiye pazarına yönelik e-ticaret sitelerini her seferinde sıfırdan yazmak yerine, kopyalanıp kullanılabilen, temiz kodlu ve genişletilebilir bir **e-ticaret şablonu** oluşturmak.

- Ağırlıklı olarak **fiziksel ürün** satışı
- **B2B** (bayi/toptan) desteği, özellik bayrağı ve satış moduyla açılır
- Hazır **yönetim paneli**
- Her müşteri projesi için şablonun **kopyalanıp** özelleştirilmesi (kopyala ve unut)
- Geliştirme ortamı **yerel** çalışır, Docker Compose ile ayağa kalkar
- Tek komutla yeni proje kurulumu (`npm run init-project`)

## 2. Teknoloji Kararları

| Konu               | Karar                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| Uygulama           | Tek Next.js monoliti (App Router, TypeScript `strict`)                                              |
| Veritabanı / ORM   | PostgreSQL + Prisma                                                                                 |
| Ödeme              | **PayTR** (iFrame API)                                                                              |
| Kimlik doğrulama   | Auth.js (müşteri ve admin rolleri)                                                                  |
| UI                 | Tailwind + shadcn/ui                                                                                |
| Validasyon         | Zod (form, API, domain ve ortam değişkenleri ortak kaynak)                                          |
| Mutasyonlar        | Server Actions / Route Handlers (ince) + servis katmanı                                             |
| Arka plan işleri   | **pg-boss** (Postgres üzerinde), `JobQueue` arayüzü arkasında; worker aynı kod tabanında ayrı süreç |
| Dosya/görsel       | Storage adapter (yerel → S3/R2)                                                                     |
| Arama              | Başlangıçta Postgres, adapter arkasında                                                             |
| Para               | `Decimal` + `currency` (varsayılan `TRY`), tek `formatMoney` yardımcısı                             |
| Dil                | Türkçe; arayüz metinleri i18n çeviri dosyasından, ürün içerikleri tek dilde                         |
| Loglama            | pino, yapılandırılmış log, korelasyon kimliği, hassas veri yazılmaz                                 |
| Hata izleme        | `ErrorReporter` arayüzü (varsayılan konsol, Sentry adapter olarak)                                  |
| Ortam değişkenleri | Tek Zod şeması ile açılışta doğrulama; kodda `process.env` kullanılmaz                              |
| Ortam              | Yerel çalışma + **Docker Compose** (PostgreSQL; e-posta testi için yerel posta yakalayıcı)          |

## 3. Yazım İlkeleri

### 3.1 SOLID

| İlke                              | Projede karşılığı                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| **S**, tek sorumluluk             | Her modül/servis tek iş yapar. Sayfa ve bileşenler yalnızca sunumdan sorumludur            |
| **O**, açık/kapalı                | Yeni ödeme/kargo/indirim kuralı, mevcut kod değiştirilmeden yeni sınıf/adapter ile eklenir |
| **L**, Liskov                     | Aynı interface'i uygulayan tüm adapter'lar birbirinin yerine geçebilir                     |
| **I**, arayüz ayrımı              | Küçük, amaca özel interface'ler (`PaymentInitiator`, `PaymentRefunder`, `ShipmentTracker`) |
| **D**, bağımlılık tersine çevirme | Servisler interface'e bağımlıdır; bağımlılıklar tek bir composition root'ta bağlanır       |

### 3.2 DRY (tekrar önleme)

- Aynı bilgi/mantık iki yerde yazılmaz; ilgili modülün servisine veya `shared/` altına çıkarılır.
- Tesadüfen benzeyen kod ile aynı bilgiyi temsil eden kod ayrı değerlendirilir. Erken soyutlama yapılmaz, üçüncü tekrarda çıkarılır.
- Sabitler, hata mesajları, para birimi ve KDV hesapları tek yerde tutulur.

### 3.3 Genel kalite kuralları

- Küçük, tek amaçlı fonksiyonlar; niyeti anlatan isimler.
- Tek bir `AppError` hiyerarşisi ile tutarlı hata yönetimi; sessiz hata yok.
- ESLint + Prettier + TypeScript `strict`; `any` yasak.
- Prisma yalnızca repository katmanında kullanılır.
- İş akışı tetiklemeleri doğrudan servislerde değil, **domain olayları** (`OrderPaid`, `OrderShipped` vb.) üzerinden yapılır.

## 4. Mimari

### 4.1 Katmanlar

```
UI (app/, components)
  → Server Actions / Route Handlers (ince, sadece giriş/çıkış)
    → Service (iş kuralları)
      → Repository (Prisma erişimi)
      → Integration adapter (PayTR, kargo, e-posta, SMS, ERP, e-fatura, analitik)
```

### 4.2 Klasör yapısı (hedef)

```
src/
  modules/        ÇEKİRDEK: catalog, cart, checkout, orders, customers, b2b, content, admin, reporting
  integrations/   ADAPTER'LAR: payment/paytr, shipping/*, invoice/*, notification/*, erp/*, analytics/*
  shared/         ortak tipler, hata sınıfları, para/KDV yardımcıları, i18n, env, logger, audit
  config/         PROJEYE ÖZEL: site.config.ts, theme.ts, features.ts
  app/            yönlendirme ve sayfa kompozisyonu; admin: app/(admin)
prisma/           şema, migration, seed
scripts/          init-project (proje başlatma)
docs/             analiz ve mimari dokümanlar
docker-compose.yml, .env.example
```

Katmanlar düzen ve okunabilirlik içindir. Şablon "kopyala ve unut" modeliyle kullanıldığı için müşteri projesinde çekirdeğe müşteri bazlı değişiklik yapılabilir.

### 4.3 Özellik bayrakları ve site modu

- `features.ts`: `b2b`, `guestCheckout`, `wishlist`, `blog`, `sms`, `captcha`.
- `site.config.ts`: `salesMode: 'retail' | 'b2b' | 'hybrid'`, cayma süresi, ücretsiz kargo limiti, audit log saklama süresi, site bilgileri.

## 5. Alan Kararları

### 5.1 Katalog

| Konu           | Karar                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| Varyant        | **Çoklu eksen** (Renk × Beden gibi); her kombinasyonun kendi SKU, stok ve fiyatı                                 |
| Nitelikler     | **Tanımlı nitelik sistemi**: admin nitelik tanımlar, ürüne bağlar, listelemede filtre olur                       |
| Görseller      | Çoklu görsel, sıralama, ana görsel; **varyanta (renk) özel görsel**; video/3D yok                                |
| Ürün ölçüleri  | `desi` ve `ağırlık` alanları baştan vardır                                                                       |
| SEO            | Slug, sitemap, robots, meta, Open Graph, Product JSON-LD, canonical, slug değişince otomatik 301                 |
| Benzer ürünler | `RelatedProductsStrategy`: kural tabanlı (kategori/nitelik, stokta olanlar öncelikli); admin elle seçerse o ezer |
| Favoriler      | `features.ts` bayrağı; üye için hesapta, misafir için tarayıcıda tutulur, girişte hesaba taşınır                 |

### 5.2 Stok

- Tek depo (çok depo sonradan eklenebilir).
- Stok takibi **ürün bazında opsiyonel** ("sınırsız" seçeneği var).
- Ödeme başlatıldığında **kısa süreli stok rezervasyonu**; süre dolarsa rezervasyon düşer.
- **Stok gelince haber ver:** Stoksuz üründe müşteri e-posta bırakır, stok girince pg-boss işiyle bildirim gider. Tekrar kayıt engellenir, "abonelikten çık" bağlantısı vardır, rate limiting uygulanır. Admin panelinde talep göstergesi bulunur.

### 5.3 Satış akışı

| Konu                   | Karar                                                                                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ödeme yöntemleri       | PayTR; B2B için havale/EFT ve vadeli ödeme. **Kapıda ödeme yok**                                                                                                                       |
| Misafir checkout       | Açık, `features.ts` bayrağıyla kapatılabilir; sipariş sonrası "hesap oluştur" teklifi                                                                                                  |
| Misafir sipariş takibi | Sipariş no + e-posta sorgulama sayfası ve e-postadaki tahmin edilemez güvenli bağlantı (aynı servis). Sipariş numarası tahmin edilemez, sorgulamada rate limiting                      |
| İndirim                | Kupon kodu + otomatik uygulanan basit kampanyalar (kategori/ürün/sepet tutarı, yüzde/sabit). `DiscountRule` arayüzü (strateji deseni) ile genişletilebilir. "2 al 1 öde" sonraya kalır |
| Kargo ücreti           | `ShippingRateCalculator` arayüzü: sabit ücret + ücretsiz kargo limiti + desi bazlı tarife. Bölge tarifesi ve canlı kargo API fiyatı sonraya kalır                                      |
| İptal                  | Müşteri kargolanmamış siparişi kendisi iptal edebilir; ödenmişse otomatik PayTR iadesi                                                                                                 |
| İade                   | Talep → admin onayı → PayTR iadesi + stoğa geri alma. Cayma süresi config'ten ayarlanır. Değişim v2'ye kalır                                                                           |
| Sipariş çıktıları      | Sipariş özeti ve kargo etiketi/paketleme çıktısı **yazdırılabilir HTML sayfa** olarak; gerçek PDF gerekirse `DocumentRenderer` arayüzüyle sonradan                                     |

### 5.4 B2B

| Konu           | Karar                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fiyatlandırma  | `PriceResolver` arayüzü. Öncelik: varyanta özel liste fiyatı → grup iskontosu → kademeli fiyat → perakende fiyat                                        |
| Kademeli fiyat | Adet bazlı kademe v0.5'te                                                                                                                               |
| Görünürlük     | `retail`: herkes perakende fiyatı görür. `hybrid`: ziyaretçi perakende, onaylı bayi kendi fiyatını görür. `b2b`: fiyatlar girişsiz gizli, üyelik onaylı |
| Vadeli ödeme   | v0.5'te basit sürüm: havale/EFT ve vadeli ödeme `PaymentMethod` olarak (manuel onaylı), kredi limiti kontrolü. Tam cari sistemi ERP'ye bırakılır        |
| Üyelik         | Şirket bilgisi (VKN, vergi dairesi), onay bekleyen bayi başvurusu                                                                                       |
| Ek             | Minimum sipariş adedi/tutarı, teklif isteme                                                                                                             |

### 5.5 Yönetim paneli

| Konu            | Karar                                                                                                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Konum           | Aynı uygulamada `/admin`; middleware ile yetki koruması; kod `modules/admin` ve `app/(admin)` altında                                                                                                            |
| Yetkilendirme   | Yetki bazlı (kontroller rol adıyla değil **yetkiyle**). Seed ile 4 hazır rol: `admin`, `editor`, `warehouse`, `accounting`. Panelden özel rol oluşturma v0.6                                                     |
| Audit log       | Tek `AuditLogger`, domain olayları üzerinden. Kim, ne zaman, neyi, eski/yeni değerle değiştirdi. Kayıtlar silinemez, yalnızca `admin` görür, saklama süresi config'ten                                           |
| İçerik yönetimi | Banner/slider, statik sayfalar (editörle, slug ve SEO alanlı), menü ve footer panelden yönetilir. Ana sayfa düzeni kodda sabit, öne çıkan ürün/kategori panelden seçilir. Sayfa oluşturucu kapsam dışı           |
| Dışa aktarma    | Sipariş ve ürün CSV/Excel dışa aktarma v0.4                                                                                                                                                                      |
| İçe aktarma     | Ürün içe aktarma ve fiyat/stok toplu güncelleme v0.6; `ImportProcessor` arayüzü, Zod satır doğrulama, transaction, hatalı satır raporu                                                                           |
| Raporlama       | v0.4: satış özeti, ürün performansı, operasyon uyarıları (bekleyen sipariş, düşük stok, iade talebi, bayi onayı). v0.6: müşteri metrikleri. Gelişmiş analitik kapsam dışı. `ReportingService` ile toplu sorgular |

### 5.6 Müşteri hesabı

- Sipariş geçmişi ve detay (durum, kargo takibi, fatura bilgisi)
- Adres defteri (varsayılan teslimat/fatura adresi)
- Tekrar sipariş ver
- Profil ve şifre yönetimi, e-posta doğrulama
- **KVKK hakları:** hesap silme (sipariş kayıtları yasal saklama gereği silinmez, kişisel alanlar anonimleştirilir) ve veri dışa aktarma

### 5.7 Entegrasyonlar

| Konu             | Karar                                                                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ödeme (PayTR)    | `PaymentProvider` arkasında `PayTRProvider`. Callback **idempotent** ve **hash doğrulamalı**                                                                                                                |
| ERP              | `ErpConnector` arayüzü + senkron altyapısı (zamanlanmış iş, kuyruk, hata kaydı, tekrar deneme) v0.6. Somut ERP adapter'ı projeye göre yazılır                                                               |
| Pazaryeri        | Şemada `Order.source` alanı; ERP altyapısını yeniden kullanan genel `ChannelConnector` yaklaşımı. Gerçek pazaryeri adapter'ları kapsam dışı                                                                 |
| E-posta          | v0.3'te zorunlu; `Notifier` arayüzü + kuyruk, şablon tabanlı. Yalnızca işlem (transactional) e-postaları                                                                                                    |
| SMS              | Adapter arayüzü hazır, varsayılan kapalı (bayrak)                                                                                                                                                           |
| WhatsApp         | Kapsam dışı                                                                                                                                                                                                 |
| Analitik         | `Analytics` arayüzü; olaylar (`view_item`, `add_to_cart`, `begin_checkout`, `purchase`) tek kaynaktan. GA4 ve Meta Pixel adapter'ları, çerez onayına bağlı. `purchase` olayı ödeme sonrası sunucu tarafında |
| Kargo            | Yurtiçi, Aras, MNG adapter'ları (takip no, etiket); canlı fiyat sorgusu sonraya                                                                                                                             |
| E-fatura/e-arşiv | Adapter arayüzü hazır, entegratör projeye göre                                                                                                                                                              |

### 5.8 E-posta listesi

| Alıcı      | E-posta                                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Müşteri    | Sipariş alındı/onaylandı, kargoya verildi (takip no), iptal, iade durumu, şifre sıfırlama, üyelik doğrulama, stok geldi bildirimi |
| Bayi (B2B) | Başvuru alındı, başvuru onaylandı/reddedildi                                                                                      |
| Yönetici   | Yeni sipariş, iade talebi, düşük stok, yeni bayi başvurusu                                                                        |

- Tetikleme domain olayları üzerinden yapılır; gönderim kuyrukta, hata durumunda tekrar denenir ve kaydedilir.
- Şablon içerikleri i18n çeviri dosyasından gelir.
- Geliştirmede e-postalar yerel yakalayıcıya düşer, gerçekten gönderilmez.

### 5.9 Güvenlik

- **Rate limiting:** giriş, kayıt, şifre sıfırlama, kupon deneme, sipariş sorgulama, stok bildirimi uçlarında. Postgres tabanlı sayaç, dış servis gerekmez.
- **CAPTCHA (Cloudflare Turnstile):** kayıt, giriş, iletişim formlarında. Bayrakla açılır, anahtar yoksa devre dışı kalır.
- **Güvenlik başlıkları:** CSP, X-Frame-Options, HSTS vb.
- **Brute-force hesap kilidi:** art arda hatalı girişte geçici kilit.

### 5.10 Gözlemlenebilirlik

- Yapılandırılmış log (pino); hassas veri (kart, parola, token) yazılmaz.
- PayTR callback ve ödeme hataları için ayrıntılı log seviyesi.
- `ErrorReporter` arayüzü; Sentry gömülmez, adapter olarak bağlanır.
- `/api/health` ve `/api/health/ready` (veritabanı ve kuyruk kontrolü).

## 6. Ödeme: PayTR

- Akış: sipariş oluşturma → token alma → iFrame'de ödeme → bildirim URL'sine (callback) hash doğrulamalı sonuç → sipariş durumu güncelleme.
- Callback aynı bildirim tekrar gelirse aynı sonucu üretir (idempotent).
- Taksit ve iade adapter içinde kalır, çekirdek bilmez.
- Sağlayıcı değişirse yalnızca yeni adapter yazılır.

## 7. Türkiye'ye Özgü Gereksinimler

- KDV dahil/hariç fiyat ayrımı, ürün bazında KDV oranı
- İl/ilçe/mahalle adres yapısı
- Fatura tipi: bireysel (TCKN) / kurumsal (VKN, vergi dairesi)
- KVKK aydınlatma metni, mesafeli satış sözleşmesi, ön bilgilendirme formu, çerez onayı
- 14 günlük cayma hakkı (config'ten ayarlanabilir)

## 8. Test Stratejisi

| Seviye           | Kapsam                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Birim            | İş kuralları: fiyat, KDV, indirim, stok rezervasyonu, kargo ücreti (zorunlu, kapsamlı)      |
| Entegrasyon      | Servis + repository + test veritabanı: ödeme callback idempotency, stok, sipariş durumları  |
| E2E (Playwright) | Yalnızca kritik akışlar: misafir checkout, üyelikli sipariş, iptal/iade, B2B giriş ve fiyat |

PayTR testlerde **fake adapter** ile çalışır. CI'da her push'ta testler koşar.

## 9. Geliştirme Ortamı

- Yerel çalışma; müşteri projesinde production hosting ayrıca belirlenir.
- `docker-compose.yml`: PostgreSQL ve yerel e-posta yakalayıcı.
- `.env.example` ile ortam değişkenleri; Zod ile açılışta doğrulanır.
- `npm run init-project`: etkileşimli kurulum (site adı, alan adı, tema, `salesMode`, bayraklar, `.env`, migration, seed, ilk admin). Çekirdek koda dokunmaz.
- Uygulama için `Dockerfile` hazır tutulur.

## 10. Fazlar

| Faz              | Kapsam                                                                                                                                                                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **v0.1 İskelet** | Proje yapısı, Docker Compose, Prisma şeması, auth, tema/config/özellik bayrakları, i18n, seed, lint/test altyapısı, `init-project`, env doğrulama, pino/`ErrorReporter`/health, pg-boss `JobQueue`, rate limiting, güvenlik başlıkları, hesap kilidi, `AuditLogger` altyapısı |
| **v0.2 Vitrin**  | Ürün listeleme, nitelik filtreleri, ürün detay (varyant seçimi), arama, sepet, SEO temelleri, benzer ürünler, favoriler, analitik olay katmanı (görüntüleme/sepet olayları)                                                                                                   |
| **v0.3 Satış**   | Checkout (misafir/üyeli), adres, PayTR, stok rezervasyonu, sipariş, iptal, e-posta bildirimleri, kupon/kampanya, kargo ücreti, müşteri hesabı, misafir sipariş takibi, stok gelince haber ver, `purchase` olayı, Turnstile                                                    |
| **v0.4 Admin**   | Ürün/kategori/nitelik/sipariş/müşteri yönetimi, iade onayı, roller, dashboard, audit log ekranı, içerik yönetimi (banner, sayfa, menü), sipariş çıktıları, talep göstergesi, sipariş-ürün dışa aktarma                                                                        |
| **v0.5 B2B**     | Müşteri grupları, fiyat listeleri, kademeli fiyat, onaylı üyelik, vadeli ödeme (basit), `salesMode`                                                                                                                                                                           |
| **v0.6 Cila**    | Ürün içe aktarma, toplu fiyat/stok, özel rol oluşturma, müşteri metrikleri, ERP senkron altyapısı, kargo adapter'ları, KVKK hakları (hesap silme/veri dışa aktarma), KVKK sayfaları, gelişmiş SEO, dokümantasyon                                                              |

Her faz sonunda çalışan, kopyalanabilir bir sürüm çıkar.

## 11. Kapsam Dışı / Sonraya Kalanlar

Kapıda ödeme, ürün yorumları, çok depo, çok para birimi, çok dilli ürün içeriği, değişim (exchange), "2 al 1 öde" gibi karmaşık kampanyalar, bölge bazlı kargo tarifesi ve canlı kargo fiyatı, tam cari/bakiye sistemi, gerçek pazaryeri adapter'ları, WhatsApp, bülten/toplu e-posta, sepet terk hatırlatması, sayfa oluşturucu, gerçek PDF üretimi, gelişmiş analitik, video/3D ürün medyası, hazır sektör şablonları (preset), ürün karşılaştırma, sadakat puanı, hediye çeki, abonelik.

## 12. v0.1 Uygulama Notları

Uygulama sırasında alınan teknik kararlar:

- **Prisma 7.10.0'a sabitlendi.** npm'deki `latest` etiketi bir 8.0 aday sürümüne (release candidate) bağlıydı ve komut yapısı farklıdır. Kararlı 7.x hattı kullanıldı; istemci `pg` sürücü adaptörüyle çalışır, üretilen kod `generated/prisma` altındadır (git'e girmez).
- **Auth.js:** `next-auth@5.0.0-beta.32` (sürüm sabit). Oturum JWT'dir, yalnızca kimlik ve kullanıcı tipi taşır; yetkiler her istekte veritabanından okunur.
- **Next.js 16 / Cache Components:** `cacheComponents` açık olduğundan `GET` route handler'ları dinamik veriye dokunmazsa build sırasında statik üretilir. Health endpoint'leri bu yüzden `connection()` ile istek anına zorlanır. Oturum okuyan sayfalar `Suspense` içindedir.
- **`middleware` yerine `proxy.ts`:** Next 16'da dosya kuralı yeniden adlandırıldı. Proxy yalnızca iyimser yönlendirme yapar; asıl yetki kontrolü `requirePermission` ile veri erişim katmanındadır.
- **Proje özelleştirmesi `project.json` ile:** `init-project` TypeScript dosyalarını düzenlemez; yalnızca `src/config/project.json` üretir, config dosyaları bunu varsayılanların üzerine uygular.
- **Kuyruk worker'ı** ayrı süreçtir (`npm run worker`); `tsx --conditions react-server` ile çalışır ki `server-only` modülleri paylaşılabilsin.
- **Entegrasyon testleri** aynı Postgres sunucusunda ayrı `<db>_test` veritabanı kullanır.
- **Varsayılan veritabanı portu 5433:** yerel makinelerde 5432'nin sık dolu olması nedeniyle seçildi.
- **Bilinen sınırlar:** CSP `unsafe-inline` içerir (nonce tabanlı CSP tüm sayfaları dinamik yapacağından ertelendi). `npm audit` geliştirme bağımlılıklarında (`eslint-config-next` → `braces`) uyarı verir; çalışma zamanını etkilemez.

## 13. Çalışma Kuralı

Kod yazımına, proje sahibi açıkça "başla" demeden geçilmez.
