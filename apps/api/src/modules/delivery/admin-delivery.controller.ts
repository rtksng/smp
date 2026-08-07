import {
  Body,
  Controller,
  Get,
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
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import type { AuthenticatedRequest } from "../auth/guards/authenticated-request";
import { AdminJwtGuard } from "../auth/guards/admin-jwt.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PermissionCode } from "../permissions/permissions.constants";
import type { AdminActionContext } from "../warehouses/warehouses.service";
import { DeliveryService } from "./delivery.service";
import {
  AdminDeliveryAssignmentListQueryDto,
  AssignDeliveryDto,
  DeliveryIncidentResponseDto,
  DeliveryAssignmentListResponseDto,
  DeliveryAssignmentResponseDto,
  UpdateCashSettlementDto
} from "./dto/delivery.dto";

@ApiBearerAuth()
@ApiTags("Admin delivery")
@Controller("admin/delivery")
@UseGuards(AdminJwtGuard, PermissionGuard)
export class AdminDeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get("assignments")
  @RequirePermission(PermissionCode.DeliveryRead)
  @ApiOperation({
    summary:
      "List delivery assignments for admin delivery management with operational filters."
  })
  @ApiOkResponse({
    description: "Delivery assignments returned.",
    type: DeliveryAssignmentListResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks delivery.read permission." })
  listAssignments(@Query() query: AdminDeliveryAssignmentListQueryDto) {
    return this.deliveryService.listAdminDeliveryAssignments(query);
  }

  @Post("assign")
  @RequirePermission(PermissionCode.DeliveryAssign)
  @ApiOperation({ summary: "Assign a customer order to a delivery partner." })
  @ApiCreatedResponse({
    description: "Delivery assignment created.",
    type: DeliveryAssignmentResponseDto
  })
  @ApiBadRequestResponse({ description: "Order cannot be assigned." })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks delivery.assign permission or warehouse access." })
  @ApiNotFoundResponse({ description: "Order, partner, or pickup warehouse was not found." })
  assignOrder(
    @Body() body: AssignDeliveryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.deliveryService.assignOrder(body, getAdminActionContext(request));
  }

  @Patch("assignments/:id/cash-settlement")
  @RequirePermission(PermissionCode.DeliveryAssign)
  @ApiOperation({ summary: "Submit or settle collected COD cash." })
  @ApiOkResponse({
    description: "Cash settlement status updated.",
    type: DeliveryAssignmentResponseDto
  })
  @ApiBadRequestResponse({ description: "Cash settlement transition is invalid." })
  @ApiNotFoundResponse({ description: "Delivery assignment was not found." })
  updateCashSettlement(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateCashSettlementDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.deliveryService.updateCashSettlement(
      id,
      body,
      getAdminActionContext(request)
    );
  }

  @Patch("incidents/:id/resolve")
  @RequirePermission(PermissionCode.DeliveryAssign)
  @ApiOperation({ summary: "Resolve a delivery partner incident." })
  @ApiOkResponse({ type: DeliveryIncidentResponseDto })
  @ApiNotFoundResponse({ description: "Delivery incident was not found." })
  resolveIncident(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.deliveryService.resolveIncident(id, getAdminActionContext(request));
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
