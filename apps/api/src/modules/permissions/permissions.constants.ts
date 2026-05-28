export enum PermissionCode {
  ProductsCreate = "products.create",
  ProductsRead = "products.read",
  ProductsUpdate = "products.update",
  ProductsDelete = "products.delete",
  OrdersRead = "orders.read",
  OrdersUpdate = "orders.update",
  OrdersCancel = "orders.cancel",
  InventoryRead = "inventory.read",
  InventoryUpdate = "inventory.update",
  WarehouseRead = "warehouse.read",
  WarehouseManage = "warehouse.manage",
  WarehouseStaffManage = "warehouse.staff.manage",
  DeliveryRead = "delivery.read",
  DeliveryAssign = "delivery.assign",
  UsersRead = "users.read",
  ReportsRead = "reports.read",
  SettingsManage = "settings.manage"
}

export type PermissionSeed = {
  code: PermissionCode;
  description: string;
  name: string;
};

export const DEFAULT_PERMISSIONS: PermissionSeed[] = [
  {
    code: PermissionCode.ProductsCreate,
    description: "Create product catalog records.",
    name: "Create products"
  },
  {
    code: PermissionCode.ProductsRead,
    description: "View product catalog records.",
    name: "Read products"
  },
  {
    code: PermissionCode.ProductsUpdate,
    description: "Update product catalog records.",
    name: "Update products"
  },
  {
    code: PermissionCode.ProductsDelete,
    description: "Delete product catalog records.",
    name: "Delete products"
  },
  {
    code: PermissionCode.OrdersRead,
    description: "View customer orders.",
    name: "Read orders"
  },
  {
    code: PermissionCode.OrdersUpdate,
    description: "Update order status and operational fields.",
    name: "Update orders"
  },
  {
    code: PermissionCode.OrdersCancel,
    description: "Cancel customer orders.",
    name: "Cancel orders"
  },
  {
    code: PermissionCode.InventoryRead,
    description: "View warehouse inventory and stock movements.",
    name: "Read inventory"
  },
  {
    code: PermissionCode.InventoryUpdate,
    description: "Adjust warehouse inventory and stock movements.",
    name: "Update inventory"
  },
  {
    code: PermissionCode.WarehouseRead,
    description: "View warehouse records.",
    name: "Read warehouses"
  },
  {
    code: PermissionCode.WarehouseManage,
    description: "Create and update warehouse records.",
    name: "Manage warehouses"
  },
  {
    code: PermissionCode.WarehouseStaffManage,
    description: "Assign staff to warehouses.",
    name: "Manage warehouse staff"
  },
  {
    code: PermissionCode.DeliveryRead,
    description: "View delivery assignments and statuses.",
    name: "Read delivery"
  },
  {
    code: PermissionCode.DeliveryAssign,
    description: "Assign delivery partners to orders.",
    name: "Assign delivery"
  },
  {
    code: PermissionCode.UsersRead,
    description: "View customer and admin user records.",
    name: "Read users"
  },
  {
    code: PermissionCode.ReportsRead,
    description: "View operational and business reports.",
    name: "Read reports"
  },
  {
    code: PermissionCode.SettingsManage,
    description: "Manage platform settings.",
    name: "Manage settings"
  }
];

export const DEFAULT_PERMISSION_CODES = DEFAULT_PERMISSIONS.map(
  (permission) => permission.code
);
