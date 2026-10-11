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
