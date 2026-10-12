import "server-only";
import {
  createSingleStorefrontCache,
  createStorefrontCache,
} from "@/shared/cache/registry";
import type { MenuKey } from "./content.schema";
import { getContentService } from "./container";

/**
 * Vitrinin her sayfasında okunan içerik (menü, banner, yasal bağlantılar).
 * Kısa süreli önbellek kullanılır; yönetim paneli değişikliklerinde temizlenir.
 */
const menus = createStorefrontCache((key: MenuKey) =>
  getContentService().menu(key),
);
const banners = createSingleStorefrontCache(() =>
  getContentService().activeBanners(),
);
const legalLinks = createSingleStorefrontCache(() =>
  getContentService().legalLinks(),
);

export const getCachedMenu = (key: MenuKey) => menus.get(key);
export const getCachedBanners = () => banners.get();
export const getCachedLegalLinks = () => legalLinks.get();
