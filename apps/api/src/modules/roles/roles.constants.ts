import {
  DEFAULT_PERMISSION_CODES,
  PermissionCode
} from "../permissions/permissions.constants";

export enum AdminRoleCode {
  SuperAdmin = "SUPER_ADMIN",
  InventoryManager = "INVENTORY_MANAGER",
  WarehouseManager = "WAREHOUSE_MANAGER",
  OrderManager = "ORDER_MANAGER",
  DeliveryManager = "DELIVERY_MANAGER",
  Support = "SUPPORT"
}

export type RoleSeed = {
  code: AdminRoleCode;
  description: string;
  isSystem: true;
  name: string;
};

export const DEFAULT_ROLES: RoleSeed[] = [
  {
    code: AdminRoleCode.SuperAdmin,
    description: "Full platform administrator with unrestricted access.",
    isSystem: true,
    name: "Super admin"
  },
  {
    code: AdminRoleCode.InventoryManager,
    description: "Manages products and inventory across assigned warehouses.",
    isSystem: true,
    name: "Inventory manager"
  },
  {
    code: AdminRoleCode.WarehouseManager,
    description: "Manages warehouse operations and assigned warehouse staff.",
    isSystem: true,
    name: "Warehouse manager"
  },
  {
    code: AdminRoleCode.OrderManager,
    description: "Manages customer order processing and cancellations.",
    isSystem: true,
    name: "Order manager"
  },
  {
    code: AdminRoleCode.DeliveryManager,
    description: "Manages delivery assignment and delivery operations.",
    isSystem: true,
    name: "Delivery manager"
  },
  {
    code: AdminRoleCode.Support,
    description: "Supports customer assistance across products, orders, and delivery.",
    isSystem: true,
    name: "Support"
  }
];

export const DEFAULT_ROLE_PERMISSION_CODES: Record<
  AdminRoleCode,
  PermissionCode[]
> = {
  [AdminRoleCode.SuperAdmin]: DEFAULT_PERMISSION_CODES,
  [AdminRoleCode.InventoryManager]: [
    PermissionCode.ProductsCreate,
    PermissionCode.ProductsRead,
    PermissionCode.ProductsUpdate,
    PermissionCode.InventoryRead,
    PermissionCode.InventoryUpdate,
    PermissionCode.WarehouseRead,
    PermissionCode.ReportsRead
  ],
  [AdminRoleCode.WarehouseManager]: [
    PermissionCode.InventoryRead,
    PermissionCode.InventoryUpdate,
    PermissionCode.WarehouseRead,
    PermissionCode.WarehouseManage,
    PermissionCode.WarehouseStaffManage,
    PermissionCode.DeliveryRead,
    PermissionCode.ReportsRead
  ],
  [AdminRoleCode.OrderManager]: [
    PermissionCode.OrdersRead,
    PermissionCode.OrdersUpdate,
    PermissionCode.OrdersCancel,
    PermissionCode.UsersRead,
    PermissionCode.UsersUpdate,
    PermissionCode.DeliveryRead,
    PermissionCode.ReportsRead
  ],
  [AdminRoleCode.DeliveryManager]: [
    PermissionCode.OrdersRead,
    PermissionCode.WarehouseRead,
    PermissionCode.DeliveryRead,
    PermissionCode.DeliveryAssign,
    PermissionCode.ReportsRead
  ],
  [AdminRoleCode.Support]: [
    PermissionCode.ProductsRead,
    PermissionCode.OrdersRead,
    PermissionCode.UsersRead,
    PermissionCode.UsersUpdate,
    PermissionCode.DeliveryRead
  ]
};
