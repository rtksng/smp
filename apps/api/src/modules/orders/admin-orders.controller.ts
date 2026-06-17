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
  Res,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import type { Response } from "express";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import type { AuthenticatedRequest } from "../auth/guards/authenticated-request";
import { AdminJwtGuard } from "../auth/guards/admin-jwt.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import {
  InvoiceFormat,
  InvoiceFormatQueryDto,
  InvoiceResponseDto
} from "../invoices/dto/invoice.dto";
import { prepareInvoiceHttpResponse } from "../invoices/invoice-http-response";
import { InvoicesService } from "../invoices/invoices.service";
import { PermissionCode } from "../permissions/permissions.constants";
import type { AdminActionContext } from "../warehouses/warehouses.service";
import {
  AdminOrderListQueryDto,
  AdminReturnActionDto,
  AdminReturnRequestListQueryDto,
  CancelOrderDto,
  OrderListResponseDto,
  OrderResponseDto,
  UpdateOrderStatusDto
} from "./dto/order.dto";
import { OrdersService } from "./orders.service";

@ApiBearerAuth()
@ApiTags("Admin orders")
@Controller("admin/orders")
@UseGuards(AdminJwtGuard, PermissionGuard)
export class AdminOrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly invoicesService: InvoicesService
  ) {}

  @Get()
  @RequirePermission(PermissionCode.OrdersRead)
  @ApiOperation({ summary: "List customer orders with warehouse scoping." })
  @ApiOkResponse({
    description: "Orders returned.",
    type: OrderListResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks orders.read permission or warehouse assignment." })
  listOrders(
    @Query() query: AdminOrderListQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ordersService.listAdminOrders(query, getAuth(request));
  }

  @Get(":id")
  @RequirePermission(PermissionCode.OrdersRead)
  @ApiOperation({ summary: "Get an order with items and status history." })
  @ApiParam({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
    name: "id"
  })
  @ApiOkResponse({
    description: "Order returned.",
    type: OrderResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks orders.read permission or warehouse assignment." })
  @ApiNotFoundResponse({ description: "Order was not found." })
  getOrder(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ordersService.getAdminOrder(id, getAuth(request));
  }

  @Get(":id/invoice")
  @RequirePermission(PermissionCode.OrdersRead)
  @ApiOperation({
    summary: "View or download a GST invoice for an order with warehouse scoping."
  })
  @ApiParam({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
    name: "id"
  })
  @ApiQuery({
    enum: InvoiceFormat,
    name: "format",
    required: false
  })
  @ApiProduces("application/json", "text/html", "application/pdf")
  @ApiOkResponse({
    description:
      "GST invoice returned. Use format=html to download invoice HTML or format=pdf to download invoice PDF.",
    type: InvoiceResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks orders.read permission or warehouse assignment." })
  @ApiNotFoundResponse({ description: "Order was not found." })
  async getOrderInvoice(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: InvoiceFormatQueryDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response
  ) {
    const invoice = await this.invoicesService.getAdminInvoice(id, getAuth(request));

    return prepareInvoiceHttpResponse(invoice, query, response);
  }

  @Patch(":id/status")
  @RequirePermission(PermissionCode.OrdersUpdate)
  @ApiOperation({ summary: "Move an order to its next operational status." })
  @ApiParam({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
    name: "id"
  })
  @ApiOkResponse({
    description: "Order status updated.",
    type: OrderResponseDto
  })
  @ApiBadRequestResponse({ description: "Requested status transition is not allowed." })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks orders.update permission or warehouse assignment." })
  @ApiNotFoundResponse({ description: "Order was not found." })
  updateStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateOrderStatusDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ordersService.updateStatus(
      id,
      body,
      getAdminActionContext(request)
    );
  }

  @Post(":id/cancel")
  @RequirePermission(PermissionCode.OrdersCancel)
  @ApiOperation({ summary: "Cancel an order when its status allows cancellation." })
  @ApiParam({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
    name: "id"
  })
  @ApiOkResponse({
    description: "Order cancelled.",
    type: OrderResponseDto
  })
  @ApiBadRequestResponse({ description: "Order cannot be cancelled in its current status." })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks orders.cancel permission or warehouse assignment." })
  @ApiNotFoundResponse({ description: "Order was not found." })
  cancelOrder(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: CancelOrderDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ordersService.cancelOrder(
      id,
      body,
      getAdminActionContext(request)
    );
  }
}

@ApiBearerAuth()
@ApiTags("Admin returns/refunds")
@Controller("admin/returns-refunds")
@UseGuards(AdminJwtGuard, PermissionGuard)
export class AdminReturnsRefundsController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermission(PermissionCode.OrdersRead)
  @ApiOperation({
    summary: "List return requests and refunds with warehouse scoping."
  })
  @ApiOkResponse({
    description: "Return requests returned.",
    type: OrderListResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks orders.read permission or warehouse assignment." })
  listReturnRequests(
    @Query() query: AdminReturnRequestListQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ordersService.listAdminReturnRequests(query, getAuth(request));
  }

  @Post(":orderId/approve")
  @RequirePermission(PermissionCode.OrdersUpdate)
  @ApiOperation({ summary: "Approve a return request and process its refund." })
  @ApiParam({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
    name: "orderId"
  })
  @ApiOkResponse({
    description: "Return request approved.",
    type: OrderResponseDto
  })
  @ApiBadRequestResponse({ description: "Return request cannot be approved." })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks orders.update permission or warehouse assignment." })
  @ApiNotFoundResponse({ description: "Order was not found." })
  approveReturnRequest(
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Body() body: AdminReturnActionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ordersService.approveAdminReturn(
      orderId,
      body,
      getAdminActionContext(request)
    );
  }

  @Post(":orderId/reject")
  @RequirePermission(PermissionCode.OrdersUpdate)
  @ApiOperation({ summary: "Reject a return request without changing the order status." })
  @ApiParam({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
    name: "orderId"
  })
  @ApiOkResponse({
    description: "Return request rejected.",
    type: OrderResponseDto
  })
  @ApiBadRequestResponse({ description: "Return request cannot be rejected." })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks orders.update permission or warehouse assignment." })
  @ApiNotFoundResponse({ description: "Order was not found." })
  rejectReturnRequest(
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Body() body: AdminReturnActionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ordersService.rejectAdminReturn(
      orderId,
      body,
      getAdminActionContext(request)
    );
  }

  @Post(":orderId/process")
  @RequirePermission(PermissionCode.OrdersUpdate)
  @ApiOperation({ summary: "Process or refetch a return refund status." })
  @ApiParam({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
    name: "orderId"
  })
  @ApiOkResponse({
    description: "Return refund processing refreshed.",
    type: OrderResponseDto
  })
  @ApiBadRequestResponse({ description: "Refund cannot be processed." })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks orders.update permission or warehouse assignment." })
  @ApiNotFoundResponse({ description: "Order was not found." })
  processReturnRefund(
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ordersService.processAdminReturnRefund(
      orderId,
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
