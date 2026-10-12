/**
 * Tüm yetkiler tek yerde tanımlanır. Yetki kontrolleri rol adıyla değil
 * bu yetki anahtarlarıyla yapılır.
 */
export const PERMISSIONS = {
  PRODUCT_READ: "product.read",
  PRODUCT_WRITE: "product.write",
  PRODUCT_DELETE: "product.delete",
  CATALOG_MANAGE: "catalog.manage",
  INVENTORY_UPDATE: "inventory.update",
  ORDER_READ: "order.read",
  ORDER_UPDATE: "order.update",
  ORDER_CANCEL: "order.cancel",
  ORDER_REFUND: "order.refund",
  RETURN_MANAGE: "return.manage",
  CUSTOMER_READ: "customer.read",
  CUSTOMER_UPDATE: "customer.update",
  B2B_APPROVE: "b2b.approve",
  PROMOTION_MANAGE: "promotion.manage",
  CONTENT_MANAGE: "content.manage",
  REPORT_VIEW: "report.view",
  EXPORT_RUN: "export.run",
  IMPORT_RUN: "import.run",
  AUDIT_VIEW: "audit.view",
  ROLE_MANAGE: "role.manage",
  SETTING_MANAGE: "setting.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly Permission[] =
  Object.values(PERMISSIONS);

/** Yetki yönetim ekranında gösterilen Türkçe etiketler, gruplar halinde. */
export const PERMISSION_GROUPS: readonly {
  label: string;
  permissions: readonly { key: Permission; label: string }[];
}[] = [
  {
    label: "Katalog",
    permissions: [
      { key: PERMISSIONS.PRODUCT_READ, label: "Ürünleri görüntüle" },
      { key: PERMISSIONS.PRODUCT_WRITE, label: "Ürün oluştur/düzenle" },
      { key: PERMISSIONS.PRODUCT_DELETE, label: "Ürün sil" },
      { key: PERMISSIONS.CATALOG_MANAGE, label: "Kategori ve nitelik yönet" },
      { key: PERMISSIONS.INVENTORY_UPDATE, label: "Stok güncelle" },
    ],
  },
  {
    label: "Sipariş ve müşteri",
    permissions: [
      { key: PERMISSIONS.ORDER_READ, label: "Siparişleri görüntüle" },
      { key: PERMISSIONS.ORDER_UPDATE, label: "Sipariş durumu güncelle" },
      { key: PERMISSIONS.ORDER_CANCEL, label: "Sipariş iptal et" },
      { key: PERMISSIONS.ORDER_REFUND, label: "İade/para iadesi yap" },
      { key: PERMISSIONS.RETURN_MANAGE, label: "İade taleplerini yönet" },
      { key: PERMISSIONS.CUSTOMER_READ, label: "Müşterileri görüntüle" },
      { key: PERMISSIONS.CUSTOMER_UPDATE, label: "Müşteri düzenle" },
      { key: PERMISSIONS.B2B_APPROVE, label: "Bayi başvurularını yönet" },
    ],
  },
  {
    label: "Pazarlama ve içerik",
    permissions: [
      {
        key: PERMISSIONS.PROMOTION_MANAGE,
        label: "Kupon, kampanya ve bayi fiyatları",
      },
      { key: PERMISSIONS.CONTENT_MANAGE, label: "İçerik yönet" },
    ],
  },
  {
    label: "Raporlama ve sistem",
    permissions: [
      { key: PERMISSIONS.REPORT_VIEW, label: "Raporları görüntüle" },
      { key: PERMISSIONS.EXPORT_RUN, label: "Dışa aktar" },
      { key: PERMISSIONS.IMPORT_RUN, label: "İçe aktar" },
      { key: PERMISSIONS.AUDIT_VIEW, label: "Denetim günlüğünü görüntüle" },
      { key: PERMISSIONS.ROLE_MANAGE, label: "Personel ve rolleri yönet" },
      { key: PERMISSIONS.SETTING_MANAGE, label: "Ayarları yönet" },
    ],
  },
];

export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as readonly string[]).includes(value);
}

export interface SystemRoleDefinition {
  name: string;
  description: string;
  permissions: readonly Permission[];
}

export const SYSTEM_ROLES: readonly SystemRoleDefinition[] = [
  {
    name: "admin",
    description: "Tüm yetkilere sahip yönetici",
    permissions: ALL_PERMISSIONS,
  },
  {
    name: "editor",
    description: "Katalog ve içerik yönetimi",
    permissions: [
      PERMISSIONS.PRODUCT_READ,
      PERMISSIONS.PRODUCT_WRITE,
      PERMISSIONS.CATALOG_MANAGE,
      PERMISSIONS.CONTENT_MANAGE,
      PERMISSIONS.PROMOTION_MANAGE,
      PERMISSIONS.IMPORT_RUN,
    ],
  },
  {
    name: "warehouse",
    description: "Depo ve sipariş hazırlama",
    permissions: [
      PERMISSIONS.PRODUCT_READ,
      PERMISSIONS.INVENTORY_UPDATE,
      PERMISSIONS.ORDER_READ,
      PERMISSIONS.ORDER_UPDATE,
      PERMISSIONS.RETURN_MANAGE,
    ],
  },
  {
    name: "accounting",
    description: "Muhasebe ve raporlama",
    permissions: [
      PERMISSIONS.ORDER_READ,
      PERMISSIONS.ORDER_REFUND,
      PERMISSIONS.CUSTOMER_READ,
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.EXPORT_RUN,
    ],
  },
];
