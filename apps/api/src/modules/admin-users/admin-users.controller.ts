import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { getAuthRequestContext } from "../auth/common/request-context";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import type { AuthenticatedRequest } from "../auth/guards/authenticated-request";
import { AdminJwtGuard } from "../auth/guards/admin-jwt.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PermissionCode } from "../permissions/permissions.constants";
import type { AdminActionContext } from "../warehouses/warehouses.service";
import { AdminUsersService } from "./admin-users.service";
import {
  AdminUserListQueryDto,
  AdminUserListResponseDto,
  AdminUserResponseDto,
  CreateAdminUserDto,
  UpdateAdminUserDto
} from "./dto/admin-user.dto";

@ApiBearerAuth()
@ApiTags("Admin users")
@Controller("admin/admin-users")
@UseGuards(AdminJwtGuard, PermissionGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @RequirePermission(PermissionCode.SettingsManage)
  @ApiOperation({ summary: "List admin users for access-control settings." })
  @ApiOkResponse({
    description: "Admin user list returned.",
    type: AdminUserListResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks settings.manage permission." })
  listAdminUsers(@Query() query: AdminUserListQueryDto) {
    return this.adminUsersService.listAdminUsers(query);
  }

  @Post()
  @RequirePermission(PermissionCode.SettingsManage)
  @ApiOperation({ summary: "Create an admin user." })
  @ApiCreatedResponse({
    description: "Admin user created.",
    type: AdminUserResponseDto
  })
  @ApiBadRequestResponse({ description: "Admin user payload is invalid." })
  @ApiConflictResponse({ description: "Admin email or mobile number already exists." })
  @ApiNotFoundResponse({ description: "Admin role was not found." })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks settings.manage permission." })
  createAdminUser(
    @Body() body: CreateAdminUserDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.adminUsersService.createAdminUser(
      body,
      getAdminActionContext(request)
    );
  }

  @Patch(":id")
  @RequirePermission(PermissionCode.SettingsManage)
  @ApiOperation({ summary: "Update an admin user." })
  @ApiParam({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6", name: "id" })
  @ApiOkResponse({
    description: "Admin user updated.",
    type: AdminUserResponseDto
  })
  @ApiBadRequestResponse({ description: "Admin user payload is invalid." })
  @ApiConflictResponse({ description: "Admin email or mobile number already exists." })
  @ApiNotFoundResponse({ description: "Admin user or role was not found." })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks settings.manage permission." })
  updateAdminUser(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateAdminUserDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.adminUsersService.updateAdminUser(
      id,
      body,
      getAdminActionContext(request)
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PermissionCode.SettingsManage)
  @ApiOperation({ summary: "Soft delete an admin user and revoke sessions." })
  @ApiParam({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6", name: "id" })
  @ApiNoContentResponse({ description: "Admin user soft deleted." })
  @ApiNotFoundResponse({ description: "Admin user was not found." })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks settings.manage permission." })
  async deleteAdminUser(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    await this.adminUsersService.deleteAdminUser(
      id,
      getAdminActionContext(request)
    );
  }
}

function getAuth(request: AuthenticatedRequest) {
  if (!request.auth) {
    throw new UnauthorizedException("Admin access token is missing or invalid.");
  }

  return request.auth;
}

function getAdminActionContext(
  request: AuthenticatedRequest
): AdminActionContext {
  return {
    auth: getAuth(request),
    ...getAuthRequestContext(request)
  };
}
