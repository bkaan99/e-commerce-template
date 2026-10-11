# E-Ticaret Şablonu

Türkiye pazarına yönelik e-ticaret siteleri için Next.js tabanlı, kopyalanıp kullanılan şablon.
PayTR ödeme, B2B bayi desteği, yönetim paneli ve temiz katmanlı mimari hedefler.

> **Durum:** v0.2 Vitrin tamamlandı (katalog, filtre, arama, ürün detayı, sepet, favoriler, SEO, analitik). Ödeme/sipariş (v0.3) ve admin ekranları (v0.4) sonraki fazlarda gelir.
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
- SEO: `/sitemap.xml`, `/robots.txt`, ürün sayfalarında JSON-LD
- Yönetim paneli: `/admin` (giriş: `/giris`)
- Gelen e-postalar (Mailpit): http://localhost:8025
- Sağlık kontrolü: `/api/health` ve `/api/health/ready`

Yalnızca yapılandırma dosyalarını üretmek için: `npm run init-project -- --skip-infra`

## Komutlar

| Komut                      | Açıklama                                              |
| -------------------------- | ----------------------------------------------------- |
| `npm run dev`              | Geliştirme sunucusu                                   |
| `npm run build` / `start`  | Production derlemesi ve çalıştırma                    |
| `npm run worker`           | Arka plan iş işleyicisi (pg-boss)                     |
| `npm run lint`             | ESLint                                                |
| `npm run typecheck`        | TypeScript denetimi                                   |
| `npm run format`           | Prettier ile biçimlendirme                            |
| `npm test`                 | Birim testleri                                        |
| `npm run test:integration` | Entegrasyon testleri (ayrı test veritabanı kullanır)  |
| `npm run db:up` / `down`   | Docker servislerini başlat / durdur                   |
| `npm run db:migrate`       | Geliştirmede migration oluştur ve uygula              |
| `npm run db:deploy`        | Mevcut migration'ları uygula                          |
| `npm run db:seed`          | Roller, müşteri grupları ve demo katalog              |
| `npm run create-admin`     | `-- <e-posta> <parola>` ile yönetici oluştur/güncelle |

## Yapı

```
src/
  app/            Yönlendirme ve sayfalar (admin: app/(admin))
  modules/        İş mantığı modülleri: auth, catalog, cart, wishlist
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

## Vitrin mimarisi

- **Katalog:** `CatalogService` listeleme, filtre (nitelik/marka/fiyat), arama, sıralama ve sayfalamayı yapar. Fiyat `PriceResolver` arayüzüyle çözülür (şimdilik perakende; B2B v0.5).
- **Sepet:** Misafir sepeti `cart_token` çerezinde, üye sepeti kullanıcıda tutulur; girişte birleştirilir. Stok `stok − rezerve` üzerinden doğrulanır.
- **Favoriler:** Üyede veritabanında, misafirde tarayıcıda (`localStorage`); girişte hesaba aktarılır.
- **Analitik:** Olaylar tek `trackEvent` arayüzünden gider; çerez onayı olmadan hiçbir izleme betiği yüklenmez.
- **Önbellek:** Veritabanı okuyan bileşenler istek anında çalışır (`connection()`); build veritabanı gerektirmez.

## Güvenlik notları

- Parolalar argon2 ile saklanır; 5 hatalı girişte hesap 15 dakika kilitlenir.
- Giriş ve diğer hassas uçlarda Postgres tabanlı rate limiting vardır.
- Oturum JWT'sinde yalnızca kimlik taşınır; yetkiler her istekte veritabanından okunur.
- CSP'de `script-src 'unsafe-inline'` bulunur (Next.js satır içi betikleri için). Nonce tabanlı CSP tüm sayfaları dinamik yapacağından şimdilik tercih edilmedi.
- `.env` dosyası git'e girmez; yalnızca `.env.example` takip edilir.

## Test

- **Birim:** iş kuralları, yapılandırma, yetki, kilitleme politikası. Veritabanı gerektirmez.
- **Entegrasyon:** `<veritabanı>_test` adlı ayrı bir veritabanında çalışır, geliştirme verinize dokunmaz. Docker servisleri açık olmalıdır.
- CI (`.github/workflows/ci.yml`) biçim, lint, tip, test ve build adımlarını koşar.

## Lisans

Henüz belirlenmedi.
