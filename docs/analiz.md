# E-Ticaret Şablonu: Analiz ve Mimari Plan

> Durum: **Analiz aşaması. Henüz kod yazılmadı.** Kod yazımına yalnızca proje sahibinin açık onayıyla başlanır.
> Son güncelleme: 2026-10-11

## 1. Amaç

Türkiye pazarına yönelik e-ticaret sitelerini her seferinde sıfırdan yazmak yerine, kopyalanıp kullanılabilen, temiz kodlu ve genişletilebilir bir **e-ticaret şablonu** oluşturmak.

- Ağırlıklı olarak **fiziksel ürün** satışı
- **B2B** (bayi/toptan) desteği, özellik bayrağı ile açılıp kapanır
- Hazır **yönetim paneli**
- Her müşteri projesi için şablonun **kopyalanıp** özelleştirilmesi

## 2. Teknoloji Kararları

| Konu | Karar | Durum |
|---|---|---|
| Uygulama | Tek Next.js monoliti (App Router, TypeScript `strict`) | Kesin |
| Veritabanı | PostgreSQL | Kesin |
| ORM | Prisma | Kesin |
| Ödeme | **PayTR** (iFrame API) | Kesin |
| Kimlik doğrulama | Auth.js (müşteri ve admin rolleri) | Önerilen |
| UI | Tailwind + shadcn/ui | Önerilen |
| Validasyon | Zod (form, API ve domain ortak kaynak) | Önerilen |
| Mutasyonlar | Server Actions / Route Handlers (ince) + servis katmanı | Önerilen |
| Dosya/görsel | Storage adapter (yerel → S3/R2) | Önerilen |
| Arama | Başlangıçta Postgres, adapter arkasında | Önerilen |
| Para hesabı | `Decimal` (asla `number` ile kuruş hesabı yapılmaz) | Kesin |

## 3. Yazım İlkeleri

### 3.1 SOLID

| İlke | Projede karşılığı |
|---|---|
| **S**, tek sorumluluk | Her modül/servis tek iş yapar. Sayfa ve bileşenler yalnızca sunumdan sorumludur |
| **O**, açık/kapalı | Yeni ödeme/kargo sağlayıcısı, mevcut kod değiştirilmeden yeni adapter yazılarak eklenir |
| **L**, Liskov | Aynı interface'i uygulayan tüm adapter'lar birbirinin yerine geçebilir |
| **I**, arayüz ayrımı | Küçük, amaca özel interface'ler (`PaymentInitiator`, `PaymentRefunder`, `ShipmentTracker`) |
| **D**, bağımlılık tersine çevirme | Servisler interface'e bağımlıdır; bağımlılıklar tek bir composition root'ta bağlanır |

### 3.2 DRY (tekrar önleme)

- Aynı bilgi/mantık iki yerde yazılmaz; ilgili modülün servisine veya `shared/` altına çıkarılır.
- Tesadüfen benzeyen kod ile aynı bilgiyi temsil eden kod ayrı değerlendirilir. Erken soyutlama yapılmaz, üçüncü tekrarda çıkarılır.
- Sabitler, hata mesajları, para birimi ve KDV hesapları tek yerde tutulur.

### 3.3 Genel kalite kuralları

- Küçük, tek amaçlı fonksiyonlar; niyeti anlatan isimler.
- Tek bir `AppError` hiyerarşisi ile tutarlı hata yönetimi; sessiz hata yok.
- ESLint + Prettier + TypeScript `strict`; `any` yasak.
- Kritik iş kuralları (fiyat, sepet, KDV, stok, ödeme) için birim test zorunlu.
- Prisma yalnızca repository katmanında kullanılır.

## 4. Mimari

### 4.1 Katmanlar

```
UI (app/, components)
  → Server Actions / Route Handlers (ince, sadece giriş/çıkış)
    → Service (iş kuralları)
      → Repository (Prisma erişimi)
      → Integration adapter (PayTR, kargo, e-posta, SMS, e-fatura)
```

### 4.2 Klasör yapısı (hedef)

```
src/
  modules/        ÇEKİRDEK: catalog, cart, checkout, orders, customers, b2b, admin
  integrations/   ADAPTER'LAR: payment/paytr, shipping/*, invoice/*, notification/*
  shared/         ortak tipler, hata sınıfları, para/KDV yardımcıları
  config/         PROJEYE ÖZEL: site.config.ts, theme.ts, features.ts
  app/            yönlendirme ve sayfa kompozisyonu
prisma/           şema, migration, seed
docs/             analiz ve mimari dokümanlar
```

### 4.3 Üç katmanlı özelleştirme

| Katman | İçerik | Müşteri başına değişir mi? |
|---|---|---|
| Çekirdek (`modules/`, `shared/`) | İş kuralları | Hayır |
| Adapter (`integrations/`) | Dış servis bağlantıları | Yeni adapter eklenir, mevcut değişmez |
| Config (`config/`) | Tema, site bilgileri, özellik bayrakları | Evet |

**Kural:** Müşteriye özel hiçbir şey çekirdeğe yazılmaz.

### 4.4 Özellik bayrakları

`features.ts` üzerinden modüller açılıp kapanır: `b2b`, `reviews`, `wishlist`, `blog`, `multiCurrency`.

## 5. Veri Modeli (özet)

- **Katalog:** Product → Variant (SKU, stok, fiyat), Category (ağaç), Brand
- **Satış:** Cart/CartItem, Order/OrderItem, Payment, Shipment, Coupon
- **Müşteri:** Customer, Address, CustomerGroup
- **İçerik:** Page, Banner
- **Yönetim:** AdminUser, Role, Setting

### B2B temeli (bayrak ile kapalı gelir, alanlar baştan vardır)

- `CustomerGroup` (bayi, toptan, perakende)
- `PriceList` (gruba özel fiyat, adet kademeli fiyat)
- Şirket bilgileri (vergi no, vergi dairesi) ve onay bekleyen üyelik
- Minimum sipariş adedi/tutarı, teklif isteme
- Cari bakiye / vadeli ödeme: **v2'ye ertelendi**

## 6. Ödeme: PayTR

- `PaymentProvider` interface'i arkasında `PayTRProvider` tek adapter olarak başlar.
- Akış: sipariş oluşturma → token alma → iFrame'de ödeme → bildirim URL'sine (callback) hash doğrulamalı sonuç → sipariş durumu güncelleme.
- Callback endpoint'i **idempotent** olmalıdır (PayTR aynı bildirimi tekrar gönderebilir) ve **hash doğrulaması zorunludur**.
- Taksit, iade gibi özellikler adapter içinde kalır, çekirdek bilmez.
- Sağlayıcı değişirse yalnızca yeni adapter yazılır.

## 7. Türkiye'ye Özgü Gereksinimler

- KDV dahil/hariç fiyat ayrımı, ürün bazında KDV oranı
- İl/ilçe/mahalle adres yapısı
- Fatura tipi: bireysel (TCKN) / kurumsal (VKN, vergi dairesi)
- Kargo: Yurtiçi, Aras, MNG (adapter; takip no, etiket)
- E-fatura/e-arşiv: adapter arayüzü hazır, entegratör müşteriye göre
- KVKK aydınlatma metni, mesafeli satış sözleşmesi, ön bilgilendirme formu, çerez onayı

## 8. Fazlar

| Faz | Kapsam |
|---|---|
| **v0.1 İskelet** | Proje yapısı, Prisma şeması, auth, tema/config sistemi, seed verisi, lint/test altyapısı |
| **v0.2 Vitrin** | Ürün listeleme, filtre, ürün detay, arama, sepet |
| **v0.3 Satış** | Checkout, adres, PayTR, sipariş, e-posta bildirimleri |
| **v0.4 Admin** | Ürün/kategori/sipariş/müşteri yönetimi, dashboard |
| **v0.5 B2B** | Müşteri grupları, fiyat listeleri, onaylı üyelik |
| **v0.6 Cila** | SEO, performans, KVKK sayfaları, kargo entegrasyonu, dokümantasyon |

Her faz sonunda çalışan, kopyalanabilir bir sürüm çıkar.

## 9. Açık Kararlar

| # | Konu | Öneri | Karar |
|---|---|---|---|
| 1 | Dil | Sadece Türkçe, metinler i18n yapısında | Bekliyor |
| 2 | Admin paneli | Aynı uygulamada `/admin` altında | Bekliyor |
| 3 | Para birimi | Sadece TL, `currency` alanı modelde | Bekliyor |
| 4 | Hosting hedefi | Belirlenmedi | Bekliyor |
| 5 | Şablon dağıtımı | GitHub template repository | Bekliyor |

## 10. Çalışma Kuralı

Kod yazımına, proje sahibi açıkça "başla" demeden geçilmez. Bu doküman, kararlar netleştikçe güncellenir.
