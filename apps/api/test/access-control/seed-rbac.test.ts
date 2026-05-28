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
