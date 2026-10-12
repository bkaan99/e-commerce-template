# E-Ticaret Şablonu

Türkiye pazarına yönelik e-ticaret siteleri için Next.js tabanlı, kopyalanıp kullanılan şablon.
PayTR ödeme, B2B bayi desteği, yönetim paneli ve temiz katmanlı mimari hedefler.

> **Durum:** v0.6 tamamlandı (KVKK ve hesap özellikleri, ürün içe aktarma/toplu güncelleme, personel ve rol yönetimi, görsel yükleme, ERP altyapısı, uçtan uca testler). Bilinen sınırlar için [docs/analiz.md](docs/analiz.md) bölüm 17.
> Plan ve kararlar: [docs/analiz.md](docs/analiz.md)

## Gereksinimler

- Node.js 22 veya üstü
- npm
- Docker (yerel PostgreSQL ve e-posta yakalayıcı için)

## Hızlı başlangıç

Yeni bir müşteri projesi için şablonu kopyalayın ve kurulum betiğini çalıştırın:

```bash
npm install
npm run init-project
```

Betik şunları yapar: site bilgilerini ve temayı sorar, `.env` üretir (`AUTH_SECRET` dahil), Docker ile PostgreSQL ve Mailpit'i başlatır, migration ve seed'i çalıştırır, ilk yönetici hesabını oluşturur.

Ardından:

```bash
npm run dev      # uygulama  → http://localhost:3000
npm run worker   # arka plan işleri (ayrı terminalde)
```

- Vitrin: `/` ana sayfa, `/kategori/<slug>`, `/urun/<slug>`, `/ara?q=`, `/sepet`, `/favoriler`
- Satış: `/odeme`, `/siparis/<no>`, `/siparis-sorgula`; üyelik: `/kayit`, `/giris`, `/hesabim`, `/sifremi-unuttum`
- SEO: `/sitemap.xml`, `/robots.txt`, ürün sayfalarında JSON-LD
- Yönetim paneli: `/admin` (giriş: `/giris`). Menü, kullanıcının yetkilerine göre görünür.
  - Pano, siparişler (kargola, teslim, iptal/iade), iade talepleri, ürünler (varyant/stok/görsel/SEO), kategoriler, nitelikler ve markalar, kupon ve kampanyalar, müşteriler, içerik (banner, sayfa, menü), denetim günlüğü
  - CSV dışa aktarma: `/admin/disa-aktar/siparisler` ve `/admin/disa-aktar/urunler`
  - Ürün içe aktarma ve SKU bazlı toplu fiyat/stok güncelleme: `/admin/urunler/ice-aktar` (önizleme + şablonlar)
  - Personel ve roller: `/admin/personel`, `/admin/roller` (özel rol oluşturma, yetki seçimi)
  - Hesabım: adres defteri, profil/parola, verilerimi indir, hesabı sil (`/hesabim`)
  - Statik sayfalar: `/sayfa/<slug>`
- Gelen e-postalar (Mailpit): http://localhost:8025
- Sağlık kontrolü: `/api/health` ve `/api/health/ready`

Yalnızca yapılandırma dosyalarını üretmek için: `npm run init-project -- --skip-infra`

## Komutlar

| Komut                      | Açıklama                                                        |
| -------------------------- | --------------------------------------------------------------- |
| `npm run dev`              | Geliştirme sunucusu                                             |
| `npm run build` / `start`  | Production derlemesi ve çalıştırma                              |
| `npm run worker`           | Arka plan işleri: e-posta, süresi dolan sipariş, stok bildirimi |
| `npm run lint`             | ESLint                                                          |
| `npm run typecheck`        | TypeScript denetimi                                             |
| `npm run format`           | Prettier ile biçimlendirme                                      |
| `npm test`                 | Birim testleri                                                  |
| `npm run test:integration` | Entegrasyon testleri (ayrı test veritabanı kullanır)            |
| `npm run test:e2e`         | Playwright uçtan uca testleri (önce `npm run build`)            |
| `npm run db:up` / `down`   | Docker servislerini başlat / durdur                             |
| `npm run db:migrate`       | Geliştirmede migration oluştur ve uygula                        |
| `npm run db:deploy`        | Mevcut migration'ları uygula                                    |
| `npm run db:seed`          | Roller, müşteri grupları ve demo katalog                        |
| `npm run create-admin`     | `-- <e-posta> <parola>` ile yönetici oluştur/güncelle           |

## Yapı

```
src/
  app/            Yönlendirme ve sayfalar (admin: app/(admin))
  modules/        İş mantığı: auth, account, b2b, catalog, cart, checkout, orders, returns, content, erp, reporting, notifications, stock-alerts, wishlist, admin
  components/     Vitrin bileşenleri (storefront, product, wishlist)
  integrations/   Dış servis adapter'ları (PayTR, kargo, ...)
  shared/         Ortak altyapı: env, db, hata, para, logger, kuyruk, rate limit, audit, i18n
  config/         Projeye özel: site.config, features, theme, project.json
  worker/         Arka plan işleyici süreci
prisma/           Şema, migration, seed
scripts/          init-project, create-admin
tests/            Test altyapısı
docs/             Analiz ve mimari
```

### Katmanlar

```
UI → Server Action / Route Handler (ince)
   → Service (iş kuralları)
   → Repository (Prisma)  |  Integration adapter (PayTR, kargo, e-posta, ...)
```

- Prisma yalnızca repository katmanında kullanılır.
- Servisler somut sınıfa değil arayüze bağımlıdır; bağımlılıklar modülün `container.ts` dosyasında bağlanır.
- Yeni sağlayıcı (ödeme, kargo, ...) mevcut kod değiştirilmeden yeni bir adapter olarak eklenir.
- Yetki kontrolleri rol adıyla değil **yetki anahtarıyla** yapılır (`src/shared/permissions.ts`).

## Projeyi özelleştirme

| Ne                                | Nerede                                            |
| --------------------------------- | ------------------------------------------------- |
| Site adı, iletişim, satış modu    | `src/config/project.json` (`init-project` üretir) |
| Özellik bayrakları                | `src/config/features.ts` / `project.json`         |
| Renkler                           | `src/config/theme.ts` / `project.json`            |
| Cayma süresi, kargo, stok rezervi | `src/config/site.config.ts`                       |
| Arayüz metinleri                  | `src/shared/i18n/messages/tr.ts`                  |
| Ortam değişkenleri                | `.env` (şema: `src/shared/env.ts`)                |

Satış modları: `retail` (herkes perakende fiyat görür), `hybrid` (onaylı bayi kendi fiyatını görür), `b2b` (fiyatlar girişsiz gizli, üyelik onaylı). `retail` dışındaki modlar `features.b2b` bayrağını gerektirir; tutarsızlık açılışta hata verir.

## B2B (bayi) kurulumu

B2B varsayılan olarak kapalıdır. Açmak için `npm run init-project` sırasında satış modunu `hybrid` veya `b2b` seçin (ya da `src/config/project.json` içinde `site.salesMode` ve `features.b2b` ayarlayın).

| Satış modu | Davranış                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------ |
| `retail`   | Herkes perakende fiyatı görür; bayi özellikleri kapalıdır                                        |
| `hybrid`   | Ziyaretçi perakende fiyatı görür; onaylı bayi kendi grubunun fiyatını görür                      |
| `b2b`      | Fiyatlar yalnızca onaylı bayilere (ve personele) görünür; yalnızca onaylı bayi sipariş verebilir |

Akış:

1. Müşteri kayıt olur ve `/bayi-basvuru` sayfasından firma bilgilerini (VKN doğrulanır) gönderir.
2. Yönetici `/admin/bayiler` ekranında başvuruyu onaylar: **müşteri grubu**, **kredi limiti** ve **minimum sipariş tutarı** belirler. Bayiye e-posta gider.
3. Fiyatlar `/admin/bayi-gruplari` ekranından yönetilir: grup iskontosu (%), varyanta özel grup fiyatı ve adet kademeleri (`10:90, 50:75`).

**Fiyat önceliği:** varyanta özel grup fiyatı → grup iskontosu → liste fiyatı; ardından adet kademesi uygulanır ve **en düşük fiyat** geçerli olur.

**Ödeme yöntemleri (yalnızca onaylı bayiler):**

- **Havale/EFT:** `src/config/project.json` içinde `site.b2b.bankAccounts` tanımlıysa görünür. Sipariş ödeme bekler, stok `bankTransferHoldHours` (varsayılan 72 saat) rezerve tutulur; yönetici sipariş sayfasından **Havale alındı** ile onaylar.
- **Vadeli ödeme:** kredi limiti tanımlıysa görünür. Sipariş hemen onaylanır ve stok düşer; kullanılan kredi = ödenmemiş vadeli siparişler toplamıdır. Limit kontrolü aynı bayinin eşzamanlı siparişlerini sıraya sokan bir kilitle yapılır. Tahsilat **Tahsil edildi** ile işaretlenir.

```json
{
  "site": {
    "salesMode": "hybrid",
    "b2b": {
      "deferredPaymentDays": 30,
      "bankTransferHoldHours": 72,
      "bankAccounts": [
        {
          "bank": "Örnek Bank",
          "accountName": "Firma A.Ş.",
          "iban": "TR00 0000 0000 0000 0000 0000 00"
        }
      ]
    }
  },
  "features": { "b2b": true }
}
```

## Ödeme (PayTR)

- `.env` içinde `PAYTR_MERCHANT_ID`, `PAYTR_MERCHANT_KEY`, `PAYTR_MERCHANT_SALT` tanımlıysa PayTR iFrame API kullanılır. Production'da zorunludur.
- Bildirim (callback) adresi: `POST /api/payments/paytr/callback`. PayTR mağaza panelinde "Bildirim URL" olarak `https://<alan-adınız>/api/payments/paytr/callback` girilmelidir.
- Anahtarlar **yoksa ve development ortamındaysa** sahte ödeme sağlayıcısı devreye girer: ödeme sayfası yerine, ödemeyi başarılı/başarısız saymanızı sağlayan yerel bir sayfa açılır. Gerçek tahsilat yapılmaz.
- Callback idempotenttir ve imza doğrulaması zorunludur; tutar uyuşmazlığında ödeme kabul edilmez.
- Süresi dolan ödeme bekleyen siparişler worker tarafından iptal edilir ve rezerve stok serbest bırakılır.

**Canlıya geçmeden önce** PayTR test modunda (`PAYTR_TEST_MODE=true`) gerçek bir sandbox ödemesi denenmelidir; alan biçimleri (tutar gösterimi, bildirim alanları) PayTR güncel dokümanıyla doğrulanmalıdır.

## Vitrin mimarisi

- **Katalog:** `CatalogService` listeleme, filtre (nitelik/marka/fiyat), arama, sıralama ve sayfalamayı yapar. Fiyat `PriceResolver` arayüzüyle çözülür (şimdilik perakende; B2B v0.5).
- **Sepet:** Misafir sepeti `cart_token` çerezinde, üye sepeti kullanıcıda tutulur; girişte birleştirilir. Stok `stok − rezerve` üzerinden doğrulanır.
- **Favoriler:** Üyede veritabanında, misafirde tarayıcıda (`localStorage`); girişte hesaba aktarılır.
- **Analitik:** Olaylar tek `trackEvent` arayüzünden gider; çerez onayı olmadan hiçbir izleme betiği yüklenmez.
- **Önbellek:** Veritabanı okuyan bileşenler istek anında çalışır (`connection()`); build veritabanı gerektirmez. Menü, banner ve kategori ağacı 60 sn süreç içi önbellekte tutulur ve yönetim değişikliğinde temizlenir; fiyat/stok önbelleğe alınmaz.

## Yasal sayfalar (KVKK, satış sözleşmesi)

`npm run db:seed` beş yasal metin **şablonunu** taslak olarak oluşturur (mesafeli satış sözleşmesi, ön bilgilendirme formu, KVKK aydınlatma metni, iade/iptal koşulları, çerez politikası). Hukuk danışmanınızla firmanıza göre uyarlayıp `/admin/icerik` ekranından yayınlayın; yayınlanınca footer ve checkout onay kutusuna otomatik bağlanır.

## Görsel yükleme ve dosya depolama

Ürün formundaki "Dosyadan yükle" JPEG/PNG/WebP/GIF kabul eder (en fazla 5 MB). Dosyalar `UPLOAD_DIR` (varsayılan `./uploads`) altında saklanır ve `/uploads/...` adresinden sunulur. **Production'da bu dizin kalıcı bir volume olmalıdır.** Farklı bir depolama (S3, R2) için `src/shared/storage/storage.ts` içindeki `FileStorage` arayüzünü uygulayıp `src/shared/storage/index.ts` içinde değiştirin.

## ERP entegrasyonu

`features.erp` açıldığında worker 15 dakikada bir `ErpConnector` üzerinden stok/fiyat çeker. Hazır `HttpJsonErpConnector`, `ERP_STOCK_URL` adresinden `[{ "sku": "...", "stock": 5, "price": 99.9 }]` bekler (`ERP_API_KEY` varsa `Authorization: Bearer`). Farklı bir ERP için `src/modules/erp/container.ts` içinde kendi bağlayıcınızı bağlayın.

## Güvenlik notları

- Parolalar argon2 ile saklanır; 5 hatalı girişte hesap 15 dakika kilitlenir.
- Giriş ve diğer hassas uçlarda Postgres tabanlı rate limiting vardır.
- Oturum JWT'sinde yalnızca kimlik taşınır; yetkiler her istekte veritabanından okunur.
- CSP'de `script-src 'unsafe-inline'` bulunur (Next.js satır içi betikleri için). Nonce tabanlı CSP tüm sayfaları dinamik yapacağından şimdilik tercih edilmedi.
- `.env` dosyası git'e girmez; yalnızca `.env.example` takip edilir.

## Test

- **Birim:** iş kuralları, yapılandırma, yetki, kilitleme politikası. Veritabanı gerektirmez.
- **Entegrasyon:** `<veritabanı>_test` adlı ayrı bir veritabanında çalışır, geliştirme verinize dokunmaz. Docker servisleri açık olmalıdır.
- **Uçtan uca (Playwright):** üretim derlemesine karşı kritik akışlar (gezinti, misafir sipariş, kayıt/giriş, admin). Yerelde yüklü Chrome ile: `E2E_BROWSER_CHANNEL=chrome npm run test:e2e`; yoksa önce `npx playwright install chromium`.
- CI (`.github/workflows/ci.yml`) biçim, lint, tip, test, build ve uçtan uca adımlarını koşar.

## Lisans

Henüz belirlenmedi.
