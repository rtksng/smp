import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { AuthTokenAudience } from "../../src/modules/auth/common/auth-token.service";
import type { AuthJwtPayload } from "../../src/modules/auth/common/auth-token.service";
import { RequirePermission } from "../../src/modules/auth/decorators/require-permission.decorator";
import { PermissionGuard } from "../../src/modules/auth/guards/permission.guard";

class TestController {}

function testHandler() {
  return undefined;
}

function createReflector(requiredPermissions: string[] | undefined): Reflector {
  return {
    getAllAndOverride: () => requiredPermissions
  } as Pick<Reflector, "getAllAndOverride"> as Reflector;
}

function createContext(auth?: AuthJwtPayload): ExecutionContext {
  return {
    getClass: () => TestController,
    getHandler: () => testHandler,
    switchToHttp: () => ({
      getNext: () => undefined,
      getRequest: () => ({ auth }),
      getResponse: () => undefined
    })
  } as unknown as ExecutionContext;
}

function adminAuth(permissions: string[]): AuthJwtPayload {
  return {
    audience: AuthTokenAudience.Admin,
    permissions,
    role: "INVENTORY_MANAGER",
    sessionId: "session-1",
    sub: "admin-1",
    tokenType: "access"
  };
}

test("RequirePermission stores permission metadata for guards", () => {
  class DecoratedController {
    @RequirePermission("products.read", "inventory.update")
    read() {
      return undefined;
    }
  }

  const metadata = Reflect.getMetadata(
    "admin:required-permissions",
    DecoratedController.prototype.read
  );

  assert.deepEqual(metadata, ["products.read", "inventory.update"]);
});

test("permission guard allows handlers without required permissions", () => {
  const guard = new PermissionGuard(createReflector(undefined));

  assert.equal(guard.canActivate(createContext(adminAuth([]))), true);
});

test("permission guard requires every declared permission", () => {
  const guard = new PermissionGuard(
    createReflector(["products.read", "products.update"])
  );

  assert.equal(
    guard.canActivate(
      createContext(adminAuth(["products.read", "products.update"]))
    ),
    true
  );
  assert.throws(
    () => guard.canActivate(createContext(adminAuth(["products.read"]))),
    ForbiddenException
  );
});
