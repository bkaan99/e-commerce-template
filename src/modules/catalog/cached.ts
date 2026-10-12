import "server-only";
import { cache } from "react";
import { createSingleStorefrontCache } from "@/shared/cache/registry";
import { catalogService } from "./container";

/**
 * Kategori ağacı fiyat/oturumdan bağımsızdır ve her sayfada okunur: süreç
 * içinde kısa süreli önbelleğe alınır (yönetim değişikliklerinde temizlenir),
 * aynı istekte birden çok bileşen kullanırsa tek çağrı yapılır.
 * `use cache` bilinçli olarak kullanılmaz: build sırasında veritabanı gerektirirdi.
 */
const categoryTree = createSingleStorefrontCache(() =>
  catalogService.getCategoryTree(),
);

export const getCategoryTree = cache(() => categoryTree.get());
