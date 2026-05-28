import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import { AdminJwtGuard } from "../auth/guards/admin-jwt.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PermissionCode } from "../permissions/permissions.constants";
import { RoleResponseDto } from "./dto/role-response.dto";
import { AdminRoleCode } from "./roles.constants";
import { RolesService } from "./roles.service";

@ApiBearerAuth()
@ApiTags("Admin roles")
@Controller("admin/roles")
@UseGuards(AdminJwtGuard, PermissionGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermission(PermissionCode.SettingsManage)
  @ApiOperation({ summary: "List admin roles and their permissions." })
  @ApiOkResponse({
    description: "Role catalog returned.",
    type: [RoleResponseDto]
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks settings.manage permission." })
  listRoles() {
    return this.rolesService.listRoles();
  }

  @Get(":code")
  @RequirePermission(PermissionCode.SettingsManage)
  @ApiOperation({ summary: "Get one admin role by code." })
  @ApiParam({
    enum: AdminRoleCode,
    name: "code"
  })
  @ApiOkResponse({
    description: "Role returned.",
    type: RoleResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks settings.manage permission." })
  @ApiNotFoundResponse({ description: "Role code does not exist." })
  getRoleByCode(@Param("code") code: string) {
    return this.rolesService.getRoleByCode(code);
  }
}
