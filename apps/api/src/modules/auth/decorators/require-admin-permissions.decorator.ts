import {
  REQUIRED_PERMISSIONS_KEY,
  RequirePermission
} from "./require-permission.decorator";

export const ADMIN_PERMISSIONS_KEY = REQUIRED_PERMISSIONS_KEY;

export function RequireAdminPermissions(...permissions: string[]) {
  return RequirePermission(...permissions);
}
