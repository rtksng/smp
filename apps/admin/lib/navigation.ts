import {
  ADMIN_PERMISSION,
  hasAnyPermission,
  type AdminPermission
} from "./permissions";

export type AdminNavigationItem = {
  href: string;
  label: string;
  permissions?: readonly AdminPermission[];
};

export const adminNavigationItems: readonly AdminNavigationItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard"
  },
  {
    href: "/products",
    label: "Products",
    permissions: [ADMIN_PERMISSION.ProductsRead]
  },
  {
    href: "/categories",
    label: "Categories",
    permissions: [ADMIN_PERMISSION.ProductsRead]
  },
  {
    href: "/brands",
    label: "Brands",
    permissions: [ADMIN_PERMISSION.ProductsRead]
  },
  {
    href: "/inventory",
    label: "Inventory",
    permissions: [ADMIN_PERMISSION.InventoryRead]
  },
  {
    href: "/orders",
    label: "Orders",
    permissions: [ADMIN_PERMISSION.OrdersRead]
  },
  {
    href: "/customers",
    label: "Customers",
    permissions: [ADMIN_PERMISSION.UsersRead]
  },
  {
    href: "/warehouses",
    label: "Warehouses",
    permissions: [ADMIN_PERMISSION.WarehouseRead]
  },
  {
    href: "/delivery",
    label: "Delivery",
    permissions: [ADMIN_PERMISSION.DeliveryRead]
  },
  {
    href: "/reports",
    label: "Reports",
    permissions: [ADMIN_PERMISSION.ReportsRead]
  },
  {
    href: "/settings",
    label: "Settings",
    permissions: [ADMIN_PERMISSION.SettingsManage]
  }
];

export function getVisibleNavigationItems(permissions: readonly string[] | undefined) {
  return adminNavigationItems.filter((item) =>
    hasAnyPermission(permissions, item.permissions)
  );
}
