import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
  ApiCreatedResponse,
  ApiNotImplementedResponse,
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
import type { AuthenticatedRequest } from "../auth/guards/authenticated-request";
import { CustomerJwtGuard } from "../auth/guards/customer-jwt.guard";
import {
  InvoiceFormat,
  InvoiceFormatQueryDto,
  InvoiceResponseDto
} from "../invoices/dto/invoice.dto";
import { prepareInvoiceHttpResponse } from "../invoices/invoice-http-response";
import { InvoicesService } from "../invoices/invoices.service";
import {
  CreateOrderDto,
  OrderListQueryDto,
  OrderListResponseDto,
  OrderResponseDto
} from "./dto/order.dto";
import { OrdersService } from "./orders.service";

@ApiBearerAuth()
@ApiTags("Orders")
@Controller("orders")
@UseGuards(CustomerJwtGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly invoicesService: InvoicesService
  ) {}

  @Post()
  @ApiOperation({ summary: "Create an order from the authenticated customer's cart." })
  @ApiCreatedResponse({
    description: "Order created and cart cleared.",
    type: OrderResponseDto
  })
  @ApiBadRequestResponse({ description: "Cart, inventory, or payment selection is invalid." })
  @ApiNotFoundResponse({ description: "Selected address was not found." })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  createOrder(
    @Body() body: CreateOrderDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ordersService.createOrder(getCustomerId(request), body);
  }

  @Get("my")
  @ApiOperation({ summary: "List the authenticated customer's orders." })
  @ApiOkResponse({
    description: "Customer orders returned.",
    type: OrderListResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  listMyOrders(
    @Query() query: OrderListQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ordersService.listMyOrders(getCustomerId(request), query);
  }

  @Get(":id/invoice")
  @ApiOperation({
    summary: "Get or download the authenticated customer's GST invoice for an order."
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
  @ApiProduces("application/json", "text/html")
  @ApiOkResponse({
    description: "GST invoice returned. Use format=html to download invoice HTML.",
    type: InvoiceResponseDto
  })
  @ApiNotImplementedResponse({ description: "PDF generation is not wired yet." })
  @ApiNotFoundResponse({ description: "Order was not found for this customer." })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  async getMyOrderInvoice(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: InvoiceFormatQueryDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response
  ) {
    const invoice = await this.invoicesService.getCustomerInvoice(
      getCustomerId(request),
      id
    );

    return prepareInvoiceHttpResponse(invoice, query, response);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get one authenticated customer order by id." })
  @ApiParam({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
    name: "id"
  })
  @ApiOkResponse({
    description: "Customer order returned.",
    type: OrderResponseDto
  })
  @ApiNotFoundResponse({ description: "Order was not found for this customer." })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  getMyOrder(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ordersService.getMyOrder(getCustomerId(request), id);
  }
}

function getCustomerId(request: AuthenticatedRequest) {
  if (!request.auth) {
    throw new UnauthorizedException("Customer access token is missing or invalid.");
  }

  return request.auth.sub;
}
