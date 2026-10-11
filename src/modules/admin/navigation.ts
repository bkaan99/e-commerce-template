import { PERMISSIONS, type Permission } from "@/shared/permissions";

export interface AdminNavItem {
  href: string;
  label: string;
  /** Menüde görünmesi için gereken yetki; boşsa her personel görür */
  permission?: Permission;
}

export const ADMIN_NAV: readonly AdminNavItem[] = [
  { href: "/admin", label: "Pano" },
  {
    href: "/admin/siparisler",
    label: "Siparişler",
    permission: PERMISSIONS.ORDER_READ,
  },
  {
    href: "/admin/iadeler",
    label: "İade talepleri",
    permission: PERMISSIONS.RETURN_MANAGE,
  },
  {
    href: "/admin/urunler",
    label: "Ürünler",
    permission: PERMISSIONS.PRODUCT_READ,
  },
  {
    href: "/admin/kategoriler",
    label: "Kategoriler",
    permission: PERMISSIONS.CATALOG_MANAGE,
  },
  {
    href: "/admin/nitelikler",
    label: "Nitelikler",
    permission: PERMISSIONS.CATALOG_MANAGE,
  },
  {
    href: "/admin/kuponlar",
    label: "Kupon ve kampanyalar",
    permission: PERMISSIONS.PROMOTION_MANAGE,
  },
  {
    href: "/admin/musteriler",
    label: "Müşteriler",
    permission: PERMISSIONS.CUSTOMER_READ,
  },
  {
    href: "/admin/icerik",
    label: "İçerik",
    permission: PERMISSIONS.CONTENT_MANAGE,
  },
  {
    href: "/admin/denetim",
    label: "Denetim günlüğü",
    permission: PERMISSIONS.AUDIT_VIEW,
  },
];

/** Kullanıcının yetkilerine göre görünen menü öğeleri. */
export function visibleNav(permissions: readonly string[]): AdminNavItem[] {
  return ADMIN_NAV.filter(
    (item) => !item.permission || permissions.includes(item.permission),
  );
}
