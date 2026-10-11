/** Arayüz metinleri. Yeni dil eklemek için aynı şekle sahip yeni bir dosya yazılır. */
export const tr = {
  common: {
    save: "Kaydet",
    cancel: "Vazgeç",
    delete: "Sil",
    edit: "Düzenle",
    search: "Ara",
    loading: "Yükleniyor...",
    backToHome: "Ana sayfaya dön",
  },
  errors: {
    generic: "Bir şeyler ters gitti. Lütfen tekrar deneyin.",
    notFound: "Aradığınız sayfa bulunamadı.",
    unauthorized: "Devam etmek için giriş yapmalısınız.",
    forbidden: "Bu işlem için yetkiniz yok.",
    rateLimited: "Çok fazla deneme yaptınız. Lütfen biraz bekleyin.",
  },
  cart: {
    title: "Sepetim",
    empty: "Sepetiniz boş.",
    addToCart: "Sepete ekle",
    itemCount: "{count} ürün",
  },
  product: {
    outOfStock: "Tükendi",
    notifyWhenAvailable: "Stoğa girince haber ver",
  },
} as const;
