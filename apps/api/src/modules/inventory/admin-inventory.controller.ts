import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import { AdminJwtGuard } from "../auth/guards/admin-jwt.guard";
import type { AuthenticatedRequest } from "../auth/guards/authenticated-request";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PermissionCode } from "../permissions/permissions.constants";
import type { AdminActionContext } from "../warehouses/warehouses.service";
import {
  AdjustStockDto,
  InventoryListQueryDto,
  InventoryStockResponseDto,
  NearExpiryQueryDto,
  ReturnDispositionDto,
  StockBatchResponseDto,
  StockInDto,
  StockMovementQueryDto,
  StockMovementResponseDto,
  TransferStockDto
} from "./dto/inventory.dto";
import { InventoryService } from "./inventory.service";

@ApiBearerAuth()
@ApiTags("Admin inventory")
@Controller("admin/inventory")
@UseGuards(AdminJwtGuard, PermissionGuard)
export class AdminInventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post("stock-in")
  @RequirePermission(PermissionCode.InventoryUpdate)
  @ApiOperation({ summary: "Receive stock into a warehouse batch." })
  @ApiCreatedResponse({ description: "Stock received.", type: InventoryStockResponseDto })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks inventory.update permission or warehouse assignment." })
  stockIn(@Body() body: StockInDto, @Req() request: AuthenticatedRequest) {
    return this.inventoryService.stockIn(body, getAdminActionContext(request));
  }

  @Post("adjust")
  @RequirePermission(PermissionCode.InventoryUpdate)
  @ApiOperation({ summary: "Apply a signed stock adjustment." })
  @ApiCreatedResponse({ description: "Stock adjusted.", type: InventoryStockResponseDto })
  @ApiBadRequestResponse({ description: "Stock or batch quantity would become negative." })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks inventory.update permission or warehouse assignment." })
  adjustStock(@Body() body: AdjustStockDto, @Req() request: AuthenticatedRequest) {
    return this.inventoryService.adjustStock(body, getAdminActionContext(request));
  }

  @Post("transfer")
  @RequirePermission(PermissionCode.InventoryUpdate)
  @ApiOperation({ summary: "Transfer stock between warehouses." })
  @ApiCreatedResponse({ description: "Stock transferred." })
  @ApiBadRequestResponse({ description: "Source stock is insufficient or warehouses are invalid." })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks inventory.update permission or warehouse assignment." })
  transferStock(
    @Body() body: TransferStockDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.inventoryService.transferStock(
      body,
      getAdminActionContext(request)
    );
  }

  @Post("return-disposition")
  @RequirePermission(PermissionCode.InventoryUpdate)
  @ApiOperation({ summary: "Disposition returned order items after inspection." })
  @ApiCreatedResponse({ description: "Returned stock disposition recorded." })
  @ApiBadRequestResponse({ description: "Return disposition is invalid or exceeds returned quantity." })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks inventory.update permission or warehouse assignment." })
  dispositionReturnedItems(
    @Body() body: ReturnDispositionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.inventoryService.dispositionReturnedItems(
      body,
      getAdminActionContext(request)
    );
  }

  @Get()
  @RequirePermission(PermissionCode.InventoryRead)
  @ApiOperation({ summary: "List inventory by warehouse and product." })
  @ApiOkResponse({ description: "Inventory returned.", type: [InventoryStockResponseDto] })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks inventory.read permission or warehouse assignment." })
  listInventory(
    @Query() query: InventoryListQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.inventoryService.listInventory(query, getAuth(request));
  }

  @Get("low-stock")
  @RequirePermission(PermissionCode.InventoryRead)
  @ApiOperation({ summary: "List inventory at or below low-stock threshold." })
  @ApiOkResponse({ description: "Low-stock inventory returned.", type: [InventoryStockResponseDto] })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks inventory.read permission or warehouse assignment." })
  listLowStock(
    @Query() query: InventoryListQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.inventoryService.listLowStock(query, getAuth(request));
  }

  @Get("near-expiry")
  @RequirePermission(PermissionCode.InventoryRead)
  @ApiOperation({ summary: "List positive-quantity batches nearing expiry." })
  @ApiOkResponse({ description: "Near-expiry batches returned.", type: [StockBatchResponseDto] })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks inventory.read permission or warehouse assignment." })
  listNearExpiry(
    @Query() query: NearExpiryQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.inventoryService.listNearExpiry(query, getAuth(request));
  }

  @Get("movements")
  @RequirePermission(PermissionCode.InventoryRead)
  @ApiOperation({ summary: "List stock movement audit trail." })
  @ApiOkResponse({ description: "Stock movements returned.", type: [StockMovementResponseDto] })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks inventory.read permission or warehouse assignment." })
  listMovements(
    @Query() query: StockMovementQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.inventoryService.listMovements(query, getAuth(request));
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
