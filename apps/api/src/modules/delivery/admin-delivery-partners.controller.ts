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
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
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
  DeliveryPartnerListQueryDto,
  DeliveryPartnerListResponseDto,
  DeliveryPartnerResponseDto,
  CreateDeliveryLedgerEntryDto,
  DeliveryLedgerEntryResponseDto,
  RejectDeliveryPartnerDto
} from "./dto/delivery.dto";

@ApiBearerAuth()
@ApiTags("Admin delivery partners")
@Controller("admin/delivery-partners")
@UseGuards(AdminJwtGuard, PermissionGuard)
export class AdminDeliveryPartnersController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get()
  @RequirePermission(PermissionCode.DeliveryRead)
  @ApiOperation({
    summary: "List delivery partners with approval, document, online, and wallet state."
  })
  @ApiOkResponse({
    description: "Delivery partners returned.",
    type: DeliveryPartnerListResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks delivery.read permission." })
  listPartners(@Query() query: DeliveryPartnerListQueryDto) {
    return this.deliveryService.listAdminDeliveryPartners(query);
  }

  @Get(":id")
  @RequirePermission(PermissionCode.DeliveryRead)
  @ApiOperation({ summary: "Get delivery partner detail with documents." })
  @ApiParam({
    example: "4d36be8a-f271-48f8-a34e-85e3fdcf3421",
    name: "id"
  })
  @ApiOkResponse({
    description: "Delivery partner returned.",
    type: DeliveryPartnerResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks delivery.read permission." })
  @ApiNotFoundResponse({ description: "Delivery partner was not found." })
  getPartner(@Param("id", ParseUUIDPipe) id: string) {
    return this.deliveryService.getAdminDeliveryPartner(id);
  }

  @Patch(":id/approve")
  @RequirePermission(PermissionCode.DeliveryAssign)
  @ApiOperation({ summary: "Approve a delivery partner for assignment." })
  @ApiParam({
    example: "4d36be8a-f271-48f8-a34e-85e3fdcf3421",
    name: "id"
  })
  @ApiOkResponse({
    description: "Delivery partner approved.",
    type: DeliveryPartnerResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks delivery.assign permission." })
  @ApiNotFoundResponse({ description: "Delivery partner was not found." })
  approvePartner(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.deliveryService.approveDeliveryPartner(
      id,
      getAdminActionContext(request)
    );
  }

  @Patch(":id/reject")
  @RequirePermission(PermissionCode.DeliveryAssign)
  @ApiOperation({ summary: "Reject a delivery partner application." })
  @ApiParam({
    example: "4d36be8a-f271-48f8-a34e-85e3fdcf3421",
    name: "id"
  })
  @ApiOkResponse({
    description: "Delivery partner rejected.",
    type: DeliveryPartnerResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks delivery.assign permission." })
  @ApiNotFoundResponse({ description: "Delivery partner was not found." })
  rejectPartner(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: RejectDeliveryPartnerDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.deliveryService.rejectDeliveryPartner(
      id,
      getAdminActionContext(request),
      body?.reason
    );
  }

  @Post(":id/ledger")
  @RequirePermission(PermissionCode.DeliveryAssign)
  @ApiOperation({ summary: "Post a delivery earning or payout ledger entry." })
  @ApiCreatedResponse({ type: DeliveryLedgerEntryResponseDto })
  createLedgerEntry(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: CreateDeliveryLedgerEntryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.deliveryService.createLedgerEntry(
      id,
      body,
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
