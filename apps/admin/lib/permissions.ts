export const ADMIN_ROLE = {
  SuperAdmin: "SUPER_ADMIN",
  InventoryManager: "INVENTORY_MANAGER",
  WarehouseManager: "WAREHOUSE_MANAGER",
  OrderManager: "ORDER_MANAGER",
  DeliveryManager: "DELIVERY_MANAGER",
  Support: "SUPPORT"
} as const;

export const ADMIN_PERMISSION = {
  DeliveryAssign: "delivery.assign",
  DeliveryRead: "delivery.read",
  InventoryRead: "inventory.read",
  InventoryUpdate: "inventory.update",
  OrdersCancel: "orders.cancel",
  OrdersRead: "orders.read",
  OrdersUpdate: "orders.update",
  ProductsCreate: "products.create",
  ProductsDelete: "products.delete",
  ProductsRead: "products.read",
  ProductsUpdate: "products.update",
  ReportsRead: "reports.read",
  SettingsManage: "settings.manage",
  UsersRead: "users.read",
  UsersUpdate: "users.update",
  WarehouseManage: "warehouse.manage",
  WarehouseRead: "warehouse.read",
  WarehouseStaffManage: "warehouse.staff.manage"
} as const;

export type AdminPermission =
  (typeof ADMIN_PERMISSION)[keyof typeof ADMIN_PERMISSION] | string;

export function hasPermission(
  permissions: readonly string[] | undefined,
  permission: AdminPermission
) {
  return Boolean(permissions?.includes(permission));
}

export function hasAnyPermission(
  permissions: readonly string[] | undefined,
  requiredPermissions: readonly AdminPermission[] | undefined
) {
  if (!requiredPermissions?.length) {
    return true;
  }

  return requiredPermissions.some((permission) =>
    hasPermission(permissions, permission)
  );
}
