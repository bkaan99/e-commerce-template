# E-Ticaret Şablonu: Analiz ve Mimari Plan

> Durum: **v0.1 İskelet, v0.2 Vitrin, v0.3 Satış, v0.4 Admin, v0.5 B2B ve v0.6 Cila tamamlandı.** Sonraki fazlara proje sahibinin onayıyla geçilir.
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

## 13. v0.2 Uygulama Notları

- **Listeleme sıralaması bellek içinde yapılır.** Fiyata göre sıralama için `searchListing` aktif ürünlerin kimlik ve en düşük fiyatını çeker, sıralama ve sayfalama serviste yapılır. Bu yaklaşım birkaç bin ürüne kadar yeterlidir; daha büyük kataloglarda `CatalogRepository` arkasında SQL tabanlı sıralamaya geçilmelidir.
- **Favoriler ürün bazlıdır** (`WishlistItem.productId`); kullanıcılar bedeni değil ürünü favorilere alır.
- **Bilinmeyen kategori/ürün adreslerinde durum kodu 200 dönebilir.** Cache Components altında içerik akıtıldığından başlık gönderildikten sonra `notFound()` durumu değiştiremez; Next.js sayfaya `noindex` ekler ve 404 arayüzünü gösterir. Arama motorları için sorun yaratmaz ama izleme araçlarında 404 sayılmaz.
- **`use cache` kullanılmadı.** Kategori ağacı gibi veriler `use cache` ile build sırasında veritabanından okunurdu; şablonun build'i veritabanı gerektirmesin diye bilinçli olarak istek anında okunur. Önbellek stratejisi v0.6'da süreç içi TTL önbelleğiyle çözüldü (bölüm 17).
- **Oturum okuyan her kod `connection()` ile istek anına alınır** (Auth.js rastgele değer ürettiği için prerender sırasında hata verirdi).
- **shadcn/ui henüz eklenmedi.** Vitrin sade Tailwind bileşenleriyle yazıldı; admin fazında (v0.4) form ve tablo bileşenleri için eklenecek.
- **Slug değişince yönlendirme:** `Redirect` tablosu ve sayfa tarafındaki 301 yönlendirmesi hazır; kayıtları admin paneli (v0.4) üretecek.

## 14. v0.3 Uygulama Notları

**Kapsama alınanlar:** checkout (misafir/üyeli), adres ve fatura bilgisi doğrulaması (cep telefonu, T.C. kimlik no, VKN), kupon ve otomatik kampanyalar (`DiscountRule`), kargo ücreti (`ShippingRateCalculator`), stok rezervasyonu, PayTR iFrame ödeme ve callback, sipariş sayfası, misafir sipariş sorgulama, müşteri iptali ve iadesi, e-posta bildirimleri (kuyruk + worker), üyelik (kayıt, e-posta doğrulama, parola sıfırlama), hesap sayfası, stok bildirimi, Turnstile entegrasyonu (bayrakla).

**Teknik kararlar**

- **Stok rezervasyonu tek SQL ile:** `UPDATE ... WHERE stock - reserved >= qty` koşullu güncellemesi eşzamanlı siparişlerde fazla satışı önler; testte 6 eşzamanlı siparişten yalnızca stok kadarı başarılı olur.
- **Ödeme sonucu idempotent:** yalnızca `PENDING` ödeme işlenir (`updateMany ... where status = PENDING`); aynı bildirimin tekrarı veya eşzamanlı çifti stoğu bir kez düşer.
- **Tutar doğrulaması:** sağlayıcının bildirdiği tutar sipariş tutarıyla eşleşmezse ödeme kabul edilmez ve `amount-mismatch` olarak loglanır.
- **PayTR sepeti tek satır gönderilir** (`Sipariş <no>`, toplam tutar). İndirim, kargo ve KDV zaten toplamdadır; böylece sepet toplamı ile `payment_amount` her zaman tutarlıdır.
- **Sağlayıcı yetenek arayüzleri:** `PaymentInitiator`, `PaymentCallbackVerifier`, `PaymentRefunder` ve bunları birleştiren `PaymentProvider`. PayTR anahtarı yokken geliştirmede `DevPaymentProvider` kullanılır.
- **İptal ve iade sırası:** ödenmiş siparişte önce sağlayıcı iadesi yapılır; iade başarısızsa sipariş değişmeden kalır.
- **Oturum çerezi adı şablona özeldir** (`ecommerce.session-token`): aynı `localhost` üzerinde çalışan başka Auth.js projeleriyle çakışmayı önler.
- **İmzalı belirteçler** (e-posta doğrulama, parola sıfırlama, stok bildirimi iptali) durumsuzdur; parola sıfırlama belirteci parola özetine bağlıdır, parola değişince aynı bağlantı tekrar kullanılamaz.
- **E-postalar kuyruktan gider:** web süreci `email.send` işini ekler, worker SMTP ile gönderir; hata olursa pg-boss yeniden dener.
- **Web ve worker kuyrukları ayrıdır:** web süreci yalnızca iş ekler (`supervise`/`schedule` kapalı), zamanlama ve bakımı worker yürütür.

**Bilinçli olarak sonraya bırakılanlar**

- Adres defteri, "tekrar sipariş ver", profil ve parola değiştirme ekranları, hesap silme ve veri dışa aktarma (KVKK): **v0.6**.
- Uçtan uca (Playwright) testleri: **v0.6**; kritik akışlar şu an birim ve veritabanlı entegrasyon testleriyle doğrulanıyor.
- İl/ilçe seçimi: il listesi hazır, ilçe serbest metindir (ilçe veri seti v0.6).
- Kargo firması entegrasyonları ve takip numarası girişi admin panelinde (v0.4) gelecek; `order.shipped` olayı ve e-posta şablonu hazır.
- `npm audit` dev bağımlılıklarında uyarı verir (v0.1 notuna bakın).

## 15. v0.4 Uygulama Notları

**Kapsama alınanlar:** yönetim paneli kabuğu (yetkiye göre menü), pano (ciro/sipariş karşılaştırması, en çok satanlar, düşük stok, stok talebi), sipariş yönetimi (durum makinesi, kargo/takip no, teslim, personel iptali ve iadesi), iade talepleri (müşteri talebi → admin onayı → kısmi iade + stoğa geri alma), ürün yönetimi (çoklu eksen varyant, nitelik, görsel, SEO, slug değişince 301), kategori/nitelik/marka yönetimi, kupon ve kampanya yönetimi, müşteri listesi, içerik yönetimi (banner, statik sayfa, menü), denetim günlüğü ekranı, sipariş/ürün CSV dışa aktarma.

**Teknik kararlar**

- **UI bileşenleri shadcn tarzıdır ama Radix bağımlılığı yoktur:** `class-variance-authority` + `tailwind-merge` ile sade (Button, Input, Select, Card, Table, Badge). Dialog yerine tarayıcı `confirm` kullanıldı; gerçek bir dialog ihtiyacı doğarsa eklenir.
- **Yetki iki katmanlı:** sayfalar `adminPage(permission)` ile "erişim yok" gösterir; Server Action'lar `runAdminAction` içinde `requirePermission` ile sunucuda tekrar doğrular. Menü gizleme güvenlik sınırı değildir.
- **Her yönetim değişikliği denetim kaydına yazılır** (`order.ship`, `product.update`, `return.approve`, `coupon.create`, …); eski/yeni değerler JSON olarak tutulur.
- **Sipariş durum geçişi koşullu güncellemeyle yapılır** (`updateMany ... where status in (izinli kaynaklar)`); iki yönetici aynı anda işlem yaparsa biri "durumu değişmiş" hatası alır.
- **Ürün düzenlemede varyant silinmez, pasifleştirilir:** sipariş geçmişi ve sepet bağları korunur. Seçenek değerleri yalnızca eklenir.
- **İade tutarı** ürün tutarının siparişteki indirim oranı kadar düşürülmüş halidir; kargo ücreti iade edilmez. Önce sağlayıcı iadesi yapılır, başarısızsa talep açık kalır.
- **Statik sayfa içeriği HTML değildir:** küçük, güvenli bir işaretleme dili (başlık, liste, kalın, bağlantı) ayrıştırılıp React öğesi olarak çizilir; `dangerouslySetInnerHTML` kullanılmaz ve yalnızca `http(s)` ile site içi bağlantılara izin verilir.
- **CSV dışa aktarma formül enjeksiyonuna karşı korumalıdır** (=, +, -, @ ile başlayan hücreler etkisizleştirilir) ve her indirme denetim kaydına yazılır.
- **Admin sayfaları yetki kontrolünü Suspense içinde yapar**; Cache Components altında parametre/oturum okuyan her şey istek anında çalışır.

**Bilinçli olarak sonraya bırakılanlar**

- Panelden özel rol oluşturma ve kullanıcı/personel yönetimi ekranı (roller seed ile gelir): **v0.6**.
- Ürün görseli yükleme (şimdilik adres girilir; storage adapter v0.6), ürün içe aktarma ve toplu fiyat/stok güncelleme: **v0.6**.
- Bayi başvuru onayı, müşteri grubu ve fiyat listesi ekranları: **v0.5** (B2B).
- İade durumu e-postası ve gelişmiş rapor filtreleri (tarih aralığı seçimi): **v0.6**.
- Stok sayımı için ayrı bir "toplu stok güncelleme" ekranı yok; stok ürün formundan güncellenir.

## 16. v0.5 Uygulama Notları

**Kapsama alınanlar:** bayi başvurusu (VKN sağlama algoritmasıyla doğrulama) ve admin onayı/ret/sonlandırma, müşteri grupları, varyanta özel grup fiyatı, grup iskontosu, genel ve gruba özel adet kademeleri, `salesMode` davranışı (`retail`/`hybrid`/`b2b`), fiyat gizleme, bayiye özel minimum sipariş tutarı, havale/EFT ve vadeli ödeme, kredi limiti, manuel ödeme onayı ve tahsilat işaretleme, bayi e-postaları.

**Teknik kararlar**

- **`PriceResolver` toplu ve asenkron hale getirildi.** Tek çağrıda birden çok varyant çözülür (`resolveUnitPrices`); grup fiyatı, iskonto ve kademeler tek sorguyla okunur, listelemede N+1 olmaz. Katalog, sepet ve checkout aynı çözücüyü kullanır.
- **Fiyat görünürlüğü sunucuda uygulanır:** `priceVisible` bayrağı DTO'ya yazılır ve gizliyken fiyat alanları `0.00` döner; ayrıca sepete ekleme Server Action'ı ve checkout aynı kuralı doğrular, JSON-LD'ye teklif yazılmaz. Arayüzü gizlemek tek başına yeterli sayılmadı.
- **Vadeli kredi kontrolü transaction içinde ve bayi satırı kilitlenerek yapılır** (`SELECT … FOR UPDATE`). Aynı bayinin eşzamanlı siparişleri sıraya girer; testte 500 TL limite 3 eşzamanlı 300 TL siparişten yalnızca biri geçer.
- **Vadeli siparişte stok rezerve edilmez, doğrudan düşer;** iptalde geri yüklenir ve kredi serbest kalır. Havale siparişinde stok `bankTransferHoldHours` süresince rezerve edilir, süre dolarsa mevcut temizleme işi siparişi iptal eder.
- **Kart dışı ödemelerde iade sağlayıcıdan yapılmaz:** ödenmiş havale/vadeli siparişin iptalinde `PayTR` çağrılmaz, iade kaydı "manuel iade" olarak açılır.
- **Havale onayı mevcut ödeme akışını yeniden kullanır** (`applyPaymentResult`): idempotent, tutar doğrulamalı, stok düşümü ve `order.paid` olayı aynıdır.
- **Menüler B2B bayrağına bağlıdır:** özellik kapalıyken bayi ekranları görünmez ve sayfalar 404 döner.

**Bilinen sınırlar**

- Fiyata göre **sıralama ve fiyat aralığı filtresi liste fiyatı üzerinden** yapılır; bayiye özel fiyat farklıysa sıralama yaklaşık olabilir. Büyük kataloglarda bayi fiyatıyla sıralama için SQL tabanlı çözüm gerekir.
- **Teklif isteme** ve **bayi onayında otomatik cari ekstre** kapsama alınmadı (tam cari sistemi kararı gereği ERP'ye bırakıldı).
- Vadeli siparişte vade tarihi ve tahsilat yalnızca manuel yönetilir; vade yaklaşınca otomatik hatırlatma yoktur.
- `init-project` banka hesaplarını sormaz; `project.json` elle düzenlenir.

## 17. v0.6 Uygulama Notları

**Kapsama alınanlar:** pano müşteri metrikleri (yeni müşteri, alışveriş yapan üye, tekrar alışveriş oranı) ve dönem seçimi (7/30/90/365 gün), iade onay/ret e-postası, KVKK ve hesap özellikleri (adres defteri, profil, parola değiştirme, veri dışa aktarma, hesap silme/anonimleştirme, tekrar sipariş ver), checkout'ta kayıtlı adres seçimi, yasal sayfa şablonları, CSV ile ürün içe aktarma ve SKU bazlı toplu fiyat/stok güncelleme, personel ve özel rol yönetimi, ürün görseli yükleme (storage adapter), kargo takip bağlantıları, ERP senkronizasyon altyapısı, SEO iyileştirmeleri, vitrin okuma önbelleği, Playwright uçtan uca testleri.

**Teknik kararlar**

- **Hesap silme anonimleştirmedir:** kullanıcı kaydı silinmez; e-posta `silinmis-<id>@anonim.invalid` yapılır, adres/favori/sepet/stok bildirimi/rol kayıtları silinir, siparişler yasal saklama gereği korunur. Açık sipariş varken silme reddedilir; personel hesabı bu yolla silinemez.
- **Yasal metinler şablondur ve taslak olarak seed edilir.** Hukuk danışmanı onayı olmadan yayınlanmamalıdır; seed mevcut (düzenlenmiş) içeriği ezmez. Yayındaki yasal sayfalar footer'a ve checkout onay kutusuna otomatik bağlanır.
- **İçe aktarma mevcut doğrulamayı yeniden kullanır** (`ProductAdminService.create/validate`): her satır bir varyanttır, aynı ürün adı/slug tek ürün olur. Mevcut ürünler güncellenmez (güncelleme için toplu güncelleme). Önizleme (dry run) hiçbir şey yazmaz.
- **Toplu güncelleme hep-ya-hiç, ERP senkronizasyonu kısmidir.** Elle yüklenen dosyada tek hata tüm dosyayı uygulamaz (yanlış fiyat riski); ERP akışında bilinmeyen/geçersiz kayıtlar atlanıp raporlanır, çünkü akış sürekli ve tek bozuk kayıt durdurmamalıdır.
- **Yetki yükseltme engellenir:** personel yalnızca kendinde olan yetkileri rollere ekleyebilir/rollerden çıkarabilir, kendi rolünü veya durumunu değiştiremez ve `role.manage` yetkisini taşıyan son etkin kullanıcı pasifleştirilemez. Sistem rolleri değiştirilemez; atanmış rol silinemez.
- **Personel daveti parola sıfırlama akışını kullanır:** hesap parolasız oluşturulur, kişiye "parola belirle" bağlantısı gider (bağlantı süresi dolarsa "Daveti tekrar gönder").
- **Görsel yükleme içerik imzasına bakar:** türü istemcinin bildirdiği MIME değil magic bytes belirler; SVG kabul edilmez, boyut 5 MB ile sınırlıdır, dosya adı sunucuda rastgele üretilir. `FileStorage` arayüzü arkasında yerel disk adaptörü vardır (`UPLOAD_DIR`); S3/R2 için yeni adaptör yazılır. `/uploads/...` bir route handler'dan sunulur (`public/` çalışma anında eklenen dosyaları sunmaz).
- **Önbellek stratejisi:** `use cache` yine kullanılmadı (build'in veritabanı istememesi). Menü, banner, yasal bağlantılar ve kategori ağacı süreç içinde 60 sn TTL ile tutulur; yönetim paneli her başarılı değişiklikte tüm vitrin önbelleklerini temizler. Çok örnekli kurulumda diğer örnekler en geç 60 sn içinde güncellenir. Fiyat, stok ve kişiye özel veri **önbelleğe alınmaz**.
- **ERP:** `ErpConnector` arayüzü + `ErpSyncService` (yalnızca değişenleri uygular, `stock.replenished` yayınlar, denetim kaydı yazar) + 15 dakikalık worker işi. `features.erp` ve `ERP_STOCK_URL` ile açılır; hazır `HttpJsonErpConnector` `[{sku, stock, price}]` döndüren bir uç nokta bekler, farklı ERP için kendi bağlayıcınızı yazın.
- **Kargo:** firma listesi ve takip bağlantı şablonları `src/shared/shipping/carriers.ts` içindedir (admin seçimi, müşteri sayfası ve e-posta aynı kaynağı kullanır). Firmaların takip adresleri değişebilir; canlıya geçmeden doğrulayın. Kargo firması API'leriyle otomatik durum çekme yapılmadı.
- **Uçtan uca testler üretim derlemesine karşı çalışır** ve seed'li demo kataloğu kullanır; test personeli/müşterisi `e2e-` önekiyle oluşturulup sonunda temizlenir. Playwright'ın CJS yükleyicisi ESM Prisma istemcisini yükleyemediğinden veritabanı işleri `tsx` ile ayrı süreçte çalışır.

**Bilinen sınırlar**

- **İlçe listesi eklendi:** 81 il / 973 ilçe, `src/shared/geo/turkey-districts.ts` (kaynak: github.com/ubeydeozdmr/turkiye-api, MIT, 2025 veri seti). Checkout ve adres defterinde ilçe, seçilen ile bağlı açılır listedir; sunucu ilçenin ile ait olduğunu doğrular. İdari değişikliklerde dosya kaynak veriden yeniden üretilmelidir.
- Yüklenen ama hiçbir ürüne bağlanmayan görseller otomatik temizlenmez.
- ERP tarafında sipariş gönderimi (ERP'ye yazma) yoktur; yalnızca stok/fiyat çekilir.
- Bildirim e-postaları parola sıfırlama şablonunu personel daveti için de kullanır.

## 18. Çalışma Kuralı

Kod yazımına, proje sahibi açıkça "başla" demeden geçilmez.
