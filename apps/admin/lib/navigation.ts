import {
  ADMIN_PERMISSION,
  hasAnyPermission,
  type AdminPermission
} from "./permissions";
import {
  INVENTORY_ACTIONS_PATH,
  INVENTORY_MOVEMENTS_PATH,
  INVENTORY_OVERVIEW_PATH
} from "./inventory-management";

export type AdminNavigationCategory =
  | "Workspace"
  | "Catalog"
  | "Fulfilment"
  | "Growth"
  | "System";

export type AdminNavigationChild = {
  href: string;
  label: string;
  permissions?: readonly AdminPermission[];
};

export type AdminNavigationItem = {
  category: AdminNavigationCategory;
  children?: readonly AdminNavigationChild[];
  href: string;
  label: string;
  permissions?: readonly AdminPermission[];
};

export const adminNavigationItems: readonly AdminNavigationItem[] = [
  {
    category: "Workspace",
    href: "/dashboard",
    label: "Dashboard"
  },
  {
    category: "Workspace",
    href: "/admin-guide",
    label: "Admin Guide"
  },
  {
    category: "Catalog",
    href: "/products",
    label: "Products",
    permissions: [ADMIN_PERMISSION.ProductsRead]
  },
  {
    category: "Catalog",
    href: "/categories",
    label: "Categories",
    permissions: [ADMIN_PERMISSION.ProductsRead]
  },
  {
    category: "Catalog",
    href: "/brands",
    label: "Brands",
    permissions: [ADMIN_PERMISSION.ProductsRead]
  },
  {
    category: "Catalog",
    href: "/product-feedback",
    label: "Product Feedback",
    permissions: [ADMIN_PERMISSION.ProductsRead]
  },
  {
    category: "Fulfilment",
    href: INVENTORY_OVERVIEW_PATH,
    label: "Inventory",
    children: [
      {
        href: INVENTORY_OVERVIEW_PATH,
        label: "Overview",
        permissions: [ADMIN_PERMISSION.InventoryRead]
      },
      {
        href: INVENTORY_ACTIONS_PATH,
        label: "Stock actions",
        permissions: [ADMIN_PERMISSION.InventoryUpdate]
      },
      {
        href: INVENTORY_MOVEMENTS_PATH,
        label: "Movements",
        permissions: [ADMIN_PERMISSION.InventoryRead]
      }
    ],
    permissions: [ADMIN_PERMISSION.InventoryRead]
  },
  {
    category: "Fulfilment",
    href: "/orders",
    label: "Orders",
    permissions: [ADMIN_PERMISSION.OrdersRead]
  },
  {
    category: "Fulfilment",
    href: "/returns-refunds",
    label: "Returns & Refunds",
    permissions: [ADMIN_PERMISSION.OrdersRead]
  },
  {
    category: "Fulfilment",
    href: "/customers",
    label: "Customers",
    permissions: [ADMIN_PERMISSION.UsersRead]
  },
  {
    category: "Fulfilment",
    href: "/warehouses",
    label: "Warehouses",
    children: [
      {
        href: "/warehouses/staff",
        label: "Warehouse staff",
        permissions: [ADMIN_PERMISSION.WarehouseStaffManage]
      },
      {
        href: "/warehouses/list",
        label: "Warehouse list",
        permissions: [ADMIN_PERMISSION.WarehouseRead]
      }
    ],
    permissions: [ADMIN_PERMISSION.WarehouseRead]
  },
  {
    category: "Fulfilment",
    href: "/delivery",
    label: "Delivery",
    permissions: [ADMIN_PERMISSION.DeliveryRead]
  },
  {
    category: "Growth",
    href: "/quote-requests",
    label: "Quote Requests",
    permissions: [ADMIN_PERMISSION.SettingsManage]
  },
  {
    category: "Growth",
    href: "/coupons",
    label: "Coupons",
    permissions: [ADMIN_PERMISSION.SettingsManage]
  },
  {
    category: "Growth",
    href: "/delivery-charges",
    label: "Delivery Charges",
    permissions: [ADMIN_PERMISSION.SettingsManage]
  },
  {
    category: "Growth",
    href: "/reports",
    label: "Reports",
    permissions: [ADMIN_PERMISSION.ReportsRead]
  },
  {
    category: "System",
    href: "/settings/admin-users",
    label: "Settings",
    permissions: [ADMIN_PERMISSION.SettingsManage]
  }
];

export function getVisibleNavigationItems(permissions: readonly string[] | undefined) {
  return adminNavigationItems
    .filter((item) => hasAnyPermission(permissions, item.permissions))
    .map((item) => ({
      ...item,
      children: item.children?.filter((child) =>
        hasAnyPermission(permissions, child.permissions)
      )
    }));
}
