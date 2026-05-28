import { Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionGuard } from "./permission.guard";

@Injectable()
export class AdminPermissionsGuard extends PermissionGuard {
  constructor(reflector: Reflector) {
    super(reflector);
  }
}
