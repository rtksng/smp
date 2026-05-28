import { SetMetadata } from "@nestjs/common";
import type { PermissionCode } from "../../permissions/permissions.constants";

export const REQUIRED_PERMISSIONS_KEY = "admin:required-permissions";

export function RequirePermission(
  ...permissions: Array<PermissionCode | string>
) {
  return SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
}
