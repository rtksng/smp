import assert from "node:assert/strict";
import { test } from "node:test";
import { getSeedSuperAdminInput } from "../../prisma/seed";
import {
  DEFAULT_PERMISSION_CODES,
  PermissionCode
} from "../../src/modules/permissions/permissions.constants";
import {
  AdminRoleCode,
  DEFAULT_ROLE_PERMISSION_CODES,
  DEFAULT_ROLES
} from "../../src/modules/roles/roles.constants";

test("default RBAC seed defines the required role and permission codes", () => {
  assert.deepEqual(
    DEFAULT_ROLES.map((role) => role.code),
    [
      AdminRoleCode.SuperAdmin,
      AdminRoleCode.InventoryManager,
      AdminRoleCode.WarehouseManager,
      AdminRoleCode.OrderManager,
      AdminRoleCode.DeliveryManager,
      AdminRoleCode.Support
    ]
  );
  assert.deepEqual(DEFAULT_PERMISSION_CODES, [
    PermissionCode.ProductsCreate,
    PermissionCode.ProductsRead,
    PermissionCode.ProductsUpdate,
    PermissionCode.ProductsDelete,
    PermissionCode.OrdersRead,
    PermissionCode.OrdersUpdate,
    PermissionCode.OrdersCancel,
    PermissionCode.InventoryRead,
    PermissionCode.InventoryUpdate,
    PermissionCode.WarehouseRead,
    PermissionCode.WarehouseManage,
    PermissionCode.WarehouseStaffManage,
    PermissionCode.DeliveryRead,
    PermissionCode.DeliveryAssign,
    PermissionCode.UsersRead,
    PermissionCode.UsersUpdate,
    PermissionCode.ReportsRead,
    PermissionCode.SettingsManage
  ]);
});

test("SUPER_ADMIN receives every seeded permission", () => {
  assert.deepEqual(
    DEFAULT_ROLE_PERMISSION_CODES[AdminRoleCode.SuperAdmin],
    DEFAULT_PERMISSION_CODES
  );
});

test("every predefined role maps only to unique seeded permissions", () => {
  const seededPermissions = new Set(DEFAULT_PERMISSION_CODES);

  for (const role of DEFAULT_ROLES) {
    const permissions = DEFAULT_ROLE_PERMISSION_CODES[role.code];

    assert.ok(permissions.length > 0, `${role.code} must have permissions`);
    assert.equal(
      new Set(permissions).size,
      permissions.length,
      `${role.code} must not contain duplicate permissions`
    );
    assert.equal(
      permissions.every((permission) => seededPermissions.has(permission)),
      true,
      `${role.code} must use only seeded permissions`
    );
  }
});

test("predefined non-super-admin roles keep their intended permission sets", () => {
  assert.deepEqual(DEFAULT_ROLE_PERMISSION_CODES[AdminRoleCode.InventoryManager], [
    PermissionCode.ProductsCreate,
    PermissionCode.ProductsRead,
    PermissionCode.ProductsUpdate,
    PermissionCode.InventoryRead,
    PermissionCode.InventoryUpdate,
    PermissionCode.WarehouseRead,
    PermissionCode.ReportsRead
  ]);
  assert.deepEqual(DEFAULT_ROLE_PERMISSION_CODES[AdminRoleCode.WarehouseManager], [
    PermissionCode.InventoryRead,
    PermissionCode.InventoryUpdate,
    PermissionCode.WarehouseRead,
    PermissionCode.WarehouseManage,
    PermissionCode.WarehouseStaffManage,
    PermissionCode.DeliveryRead,
    PermissionCode.ReportsRead
  ]);
  assert.deepEqual(DEFAULT_ROLE_PERMISSION_CODES[AdminRoleCode.OrderManager], [
    PermissionCode.OrdersRead,
    PermissionCode.OrdersUpdate,
    PermissionCode.OrdersCancel,
    PermissionCode.UsersRead,
    PermissionCode.UsersUpdate,
    PermissionCode.DeliveryRead,
    PermissionCode.ReportsRead
  ]);
  assert.deepEqual(DEFAULT_ROLE_PERMISSION_CODES[AdminRoleCode.DeliveryManager], [
    PermissionCode.OrdersRead,
    PermissionCode.WarehouseRead,
    PermissionCode.DeliveryRead,
    PermissionCode.DeliveryAssign,
    PermissionCode.ReportsRead
  ]);
  assert.deepEqual(DEFAULT_ROLE_PERMISSION_CODES[AdminRoleCode.Support], [
    PermissionCode.ProductsRead,
    PermissionCode.OrdersRead,
    PermissionCode.UsersRead,
    PermissionCode.UsersUpdate,
    PermissionCode.DeliveryRead
  ]);
});

test("seed super admin input is optional but rejects partial credentials", () => {
  assert.equal(getSeedSuperAdminInput({}), null);
  assert.throws(
    () =>
      getSeedSuperAdminInput({
        SEED_SUPER_ADMIN_EMAIL: "owner@example.com"
      }),
    /SEED_SUPER_ADMIN_PASSWORD/
  );
  assert.deepEqual(
    getSeedSuperAdminInput({
      SEED_SUPER_ADMIN_EMAIL: "owner@example.com",
      SEED_SUPER_ADMIN_PASSWORD: "change-this-password"
    }),
    {
      email: "owner@example.com",
      firstName: "Super",
      lastName: "Admin",
      mobileNumber: null,
      password: "change-this-password"
    }
  );
});
