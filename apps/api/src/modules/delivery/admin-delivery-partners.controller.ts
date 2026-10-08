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
  ApiConflictResponse,
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
  CreateDeliveryPartnerDto,
  DeliveryEarningsSummaryResponseDto,
  DeliveryLedgerEntryResponseDto,
  RejectDeliveryPartnerDto,
  UpdateDeliveryPartnerDto
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
    summary:
      "List delivery partners with approval, warehouse, pay, document, online, and wallet state. Warehouse staff see partners of their own warehouses."
  })
  @ApiOkResponse({
    description: "Delivery partners returned.",
    type: DeliveryPartnerListResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks delivery.read permission or warehouse access." })
  listPartners(
    @Query() query: DeliveryPartnerListQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.deliveryService.listAdminDeliveryPartners(query, getAuth(request));
  }

  @Post()
  @RequirePermission(PermissionCode.DeliveryPartnersManage)
  @ApiOperation({
    summary:
      "Add an active delivery partner. Warehouse staff add partners to their own warehouse; pay fields need delivery.payouts.manage."
  })
  @ApiCreatedResponse({
    description: "Delivery partner created.",
    type: DeliveryPartnerResponseDto
  })
  @ApiBadRequestResponse({ description: "Partner details, warehouses, or pay are invalid." })
  @ApiConflictResponse({ description: "Mobile number or email is already registered." })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks the required permission or warehouse access." })
  createPartner(
    @Body() body: CreateDeliveryPartnerDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.deliveryService.createDeliveryPartner(
      body,
      getAdminActionContext(request)
    );
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
  getPartner(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.deliveryService.getAdminDeliveryPartner(id, getAuth(request));
  }

  @Patch(":id")
  @RequirePermission(PermissionCode.DeliveryPartnersManage)
  @ApiOperation({
    summary:
      "Edit delivery partner details. Changing warehouses needs access to every warehouse; pay fields need delivery.payouts.manage."
  })
  @ApiParam({
    example: "4d36be8a-f271-48f8-a34e-85e3fdcf3421",
    name: "id"
  })
  @ApiOkResponse({
    description: "Delivery partner updated.",
    type: DeliveryPartnerResponseDto
  })
  @ApiBadRequestResponse({ description: "Partner details, warehouses, or pay are invalid." })
  @ApiConflictResponse({ description: "Mobile number or email is already registered." })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks the required permission or warehouse access." })
  @ApiNotFoundResponse({ description: "Delivery partner was not found." })
  updatePartner(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateDeliveryPartnerDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.deliveryService.updateDeliveryPartner(
      id,
      body,
      getAdminActionContext(request)
    );
  }

  @Get(":id/earnings")
  @RequirePermission(PermissionCode.DeliveryRead)
  @ApiOperation({ summary: "Get a delivery partner's pay, earnings totals, and payment history." })
  @ApiParam({
    example: "4d36be8a-f271-48f8-a34e-85e3fdcf3421",
    name: "id"
  })
  @ApiOkResponse({ type: DeliveryEarningsSummaryResponseDto })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks delivery.read permission." })
  @ApiNotFoundResponse({ description: "Delivery partner was not found." })
  getPartnerEarnings(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.deliveryService.getAdminDeliveryPartnerEarnings(id, getAuth(request));
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
  @RequirePermission(PermissionCode.DeliveryPayoutsManage)
  @ApiOperation({
    summary: "Post a delivery earning, monthly salary credit, or payout ledger entry."
  })
  @ApiCreatedResponse({ type: DeliveryLedgerEntryResponseDto })
  @ApiBadRequestResponse({ description: "Entry is invalid for this partner." })
  @ApiConflictResponse({ description: "Salary for the month was already credited, or the balance changed." })
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
