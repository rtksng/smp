import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRED_PERMISSIONS_KEY } from "../decorators/require-permission.decorator";
import type { AuthenticatedRequest } from "./authenticated-request";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const permissionSet = new Set(request.auth?.permissions ?? []);
    const hasEveryPermission = requiredPermissions.every((permission) =>
      permissionSet.has(permission)
    );

    if (!hasEveryPermission) {
      throw new ForbiddenException("Admin permission is required.");
    }

    return true;
  }
}
