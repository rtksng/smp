import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { REQUIRED_PERMISSIONS_KEY } from "../../src/modules/auth/decorators/require-permission.decorator";
import { AdminJwtGuard } from "../../src/modules/auth/guards/admin-jwt.guard";
import { PermissionGuard } from "../../src/modules/auth/guards/permission.guard";
import { PermissionCode } from "../../src/modules/permissions/permissions.constants";
import { AdminUploadsController } from "../../src/modules/uploads/uploads.controller";

test("admin upload routes require admin auth and product update permission", () => {
  const guards = Reflect.getMetadata(GUARDS_METADATA, AdminUploadsController) ?? [];
  const guardNames = guards.map((guard: new (...args: never[]) => unknown) => guard.name);

  assert.deepEqual(guardNames, [AdminJwtGuard.name, PermissionGuard.name]);
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      AdminUploadsController.prototype.uploadImage
    ),
    [PermissionCode.ProductsUpdate]
  );
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      AdminUploadsController.prototype.uploadDocument
    ),
    [PermissionCode.ProductsUpdate]
  );
});
