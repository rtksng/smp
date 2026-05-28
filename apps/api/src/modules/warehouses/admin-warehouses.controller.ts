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
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import { AdminJwtGuard } from "../auth/guards/admin-jwt.guard";
import type { AuthenticatedRequest } from "../auth/guards/authenticated-request";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PermissionCode } from "../permissions/permissions.constants";
import {
  AssignWarehouseStaffDto,
  CreateWarehouseDto,
  UpdateWarehouseDto,
  WarehouseListQueryDto,
  WarehouseListResponseDto,
  WarehouseResponseDto,
  WarehouseStaffResponseDto
} from "./dto/warehouse.dto";
import type { AdminActionContext } from "./warehouses.service";
import { WarehousesService } from "./warehouses.service";

@ApiBearerAuth()
@ApiTags("Admin warehouses")
@Controller("admin/warehouses")
@UseGuards(AdminJwtGuard, PermissionGuard)
export class AdminWarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Post()
  @RequirePermission(PermissionCode.WarehouseManage)
  @ApiOperation({ summary: "Create a warehouse." })
  @ApiCreatedResponse({ description: "Warehouse created.", type: WarehouseResponseDto })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks warehouse.manage permission." })
  @ApiConflictResponse({ description: "Warehouse code already exists." })
  createWarehouse(
    @Body() body: CreateWarehouseDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.warehousesService.createWarehouse(
      body,
      getAdminActionContext(request)
    );
  }

  @Get()
  @RequirePermission(PermissionCode.WarehouseRead)
  @ApiOperation({ summary: "List warehouses." })
  @ApiOkResponse({ description: "Warehouse list returned.", type: WarehouseListResponseDto })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks warehouse.read permission." })
  listWarehouses(
    @Query() query: WarehouseListQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.warehousesService.listWarehouses(query, getAuth(request));
  }

  @Get(":id")
  @RequirePermission(PermissionCode.WarehouseRead)
  @ApiOperation({ summary: "Get warehouse detail." })
  @ApiParam({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6", name: "id" })
  @ApiOkResponse({ description: "Warehouse returned.", type: WarehouseResponseDto })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks warehouse.read permission." })
  @ApiNotFoundResponse({ description: "Warehouse does not exist." })
  getWarehouse(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.warehousesService.getWarehouse(id, getAuth(request));
  }

  @Patch(":id")
  @RequirePermission(PermissionCode.WarehouseManage)
  @ApiOperation({ summary: "Update a warehouse." })
  @ApiParam({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6", name: "id" })
  @ApiOkResponse({ description: "Warehouse updated.", type: WarehouseResponseDto })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks warehouse.manage permission or assignment." })
  @ApiConflictResponse({ description: "Warehouse code already exists." })
  @ApiNotFoundResponse({ description: "Warehouse does not exist." })
  updateWarehouse(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateWarehouseDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.warehousesService.updateWarehouse(
      id,
      body,
      getAdminActionContext(request)
    );
  }

  @Patch(":id/activate")
  @RequirePermission(PermissionCode.WarehouseManage)
  @ApiOperation({ summary: "Activate a warehouse." })
  @ApiParam({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6", name: "id" })
  @ApiOkResponse({ description: "Warehouse activated.", type: WarehouseResponseDto })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks warehouse.manage permission or assignment." })
  activateWarehouse(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.warehousesService.activateWarehouse(
      id,
      getAdminActionContext(request)
    );
  }

  @Patch(":id/deactivate")
  @RequirePermission(PermissionCode.WarehouseManage)
  @ApiOperation({ summary: "Deactivate a warehouse." })
  @ApiParam({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6", name: "id" })
  @ApiOkResponse({ description: "Warehouse deactivated.", type: WarehouseResponseDto })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks warehouse.manage permission or assignment." })
  deactivateWarehouse(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.warehousesService.deactivateWarehouse(
      id,
      getAdminActionContext(request)
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PermissionCode.WarehouseManage)
  @ApiOperation({ summary: "Soft delete a warehouse only when it is safe." })
  @ApiParam({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6", name: "id" })
  @ApiNoContentResponse({ description: "Warehouse soft deleted." })
  @ApiBadRequestResponse({
    description: "Warehouse has inventory, stock batches, or stock movements."
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks warehouse.manage permission or assignment." })
  async deleteWarehouse(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    await this.warehousesService.deleteWarehouse(
      id,
      getAdminActionContext(request)
    );
  }

  @Post(":id/staff")
  @RequirePermission(PermissionCode.WarehouseStaffManage)
  @ApiOperation({ summary: "Assign admin staff to a warehouse." })
  @ApiParam({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6", name: "id" })
  @ApiCreatedResponse({
    description: "Warehouse staff assigned.",
    type: WarehouseStaffResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks warehouse.staff.manage permission or assignment." })
  @ApiNotFoundResponse({ description: "Warehouse or admin user does not exist." })
  assignStaff(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: AssignWarehouseStaffDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.warehousesService.assignStaff(
      id,
      body,
      getAdminActionContext(request)
    );
  }

  @Get(":id/staff")
  @RequirePermission(PermissionCode.WarehouseStaffManage)
  @ApiOperation({ summary: "List warehouse staff assignments." })
  @ApiParam({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6", name: "id" })
  @ApiOkResponse({
    description: "Warehouse staff assignments returned.",
    type: [WarehouseStaffResponseDto]
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks warehouse.staff.manage permission or assignment." })
  listStaff(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.warehousesService.listStaff(id, getAuth(request));
  }

  @Delete(":id/staff/:staffId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PermissionCode.WarehouseStaffManage)
  @ApiOperation({ summary: "Remove a staff assignment from a warehouse." })
  @ApiParam({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6", name: "id" })
  @ApiParam({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6", name: "staffId" })
  @ApiNoContentResponse({ description: "Warehouse staff assignment removed." })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks warehouse.staff.manage permission or assignment." })
  @ApiNotFoundResponse({ description: "Warehouse staff assignment does not exist." })
  async removeStaff(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("staffId", ParseUUIDPipe) staffId: string,
    @Req() request: AuthenticatedRequest
  ) {
    await this.warehousesService.removeStaff(
      id,
      staffId,
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
    ipAddress: request.ip,
    userAgent: request.headers["user-agent"]
  };
}
