import { Controller, Get, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import { AdminJwtGuard } from "../auth/guards/admin-jwt.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PermissionCode } from "./permissions.constants";
import { PermissionResponseDto } from "./dto/permission-response.dto";
import { PermissionsService } from "./permissions.service";

@ApiBearerAuth()
@ApiTags("Admin permissions")
@Controller("admin/permissions")
@UseGuards(AdminJwtGuard, PermissionGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermission(PermissionCode.SettingsManage)
  @ApiOperation({ summary: "List admin permission codes." })
  @ApiOkResponse({
    description: "Permission catalog returned.",
    type: [PermissionResponseDto]
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks settings.manage permission." })
  listPermissions() {
    return this.permissionsService.listPermissions();
  }
}
