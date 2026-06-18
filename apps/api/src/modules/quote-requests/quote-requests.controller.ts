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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import type { AuthenticatedRequest } from "../auth/guards/authenticated-request";
import { AdminJwtGuard } from "../auth/guards/admin-jwt.guard";
import { CustomerJwtGuard } from "../auth/guards/customer-jwt.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PermissionCode } from "../permissions/permissions.constants";
import {
  CreateQuoteRequestDto,
  QuoteConversionResponseDto,
  QuoteOrderConversionResponseDto,
  QuoteRequestListQueryDto,
  QuoteRequestListResponseDto,
  QuoteRequestResponseDto,
  SendQuoteResponseDto,
  UpdateCustomerQuoteDecisionDto,
  UpdateQuoteRequestStatusDto
} from "./dto/quote-request.dto";
import { QuoteRequestsService } from "./quote-requests.service";

@ApiTags("Quote requests")
@Controller("quote-requests")
export class QuoteRequestsController {
  constructor(private readonly quoteRequestsService: QuoteRequestsService) {}

  @Get("my")
  @UseGuards(CustomerJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "List quote requests visible to the authenticated customer."
  })
  @ApiOkResponse({
    description: "Customer quote requests returned.",
    type: QuoteRequestListResponseDto
  })
  @ApiUnauthorizedResponse({
    description: "Customer access token is missing or invalid."
  })
  listMyQuoteRequests(
    @Query() query: QuoteRequestListQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.quoteRequestsService.listCustomerQuoteRequests(
      getCustomerId(request),
      query
    );
  }

  @Post()
  @ApiOperation({ summary: "Create a bulk quote request from the customer website." })
  @ApiCreatedResponse({
    description: "Quote request saved.",
    type: QuoteRequestResponseDto
  })
  createQuoteRequest(@Body() body: CreateQuoteRequestDto) {
    return this.quoteRequestsService.createQuoteRequest(body);
  }

  @Patch("my/:id/decision")
  @UseGuards(CustomerJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Accept or reject a quoted request." })
  @ApiOkResponse({
    description: "Customer quote decision saved.",
    type: QuoteRequestResponseDto
  })
  @ApiBadRequestResponse({ description: "No quotation is available to decide." })
  @ApiNotFoundResponse({
    description: "Quote request was not found for this customer."
  })
  @ApiUnauthorizedResponse({
    description: "Customer access token is missing or invalid."
  })
  updateMyQuoteDecision(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateCustomerQuoteDecisionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.quoteRequestsService.updateCustomerQuoteDecision(
      getCustomerId(request),
      id,
      body
    );
  }

  @Post("my/:id/convert-to-cart")
  @UseGuards(CustomerJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Prepare the cart from an accepted quote." })
  @ApiCreatedResponse({
    description: "Customer cart prepared from the accepted quote.",
    type: QuoteConversionResponseDto
  })
  @ApiBadRequestResponse({
    description: "Quote must be accepted and contain catalog items."
  })
  @ApiNotFoundResponse({
    description: "Quote request was not found for this customer."
  })
  @ApiUnauthorizedResponse({
    description: "Customer access token is missing or invalid."
  })
  convertMyQuoteToCart(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.quoteRequestsService.convertCustomerQuoteToCart(
      getCustomerId(request),
      id
    );
  }

  @Post("my/:id/convert-to-order")
  @UseGuards(CustomerJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create an order from an accepted custom quote." })
  @ApiCreatedResponse({
    description: "Customer order created from the accepted custom quote.",
    type: QuoteOrderConversionResponseDto
  })
  @ApiBadRequestResponse({
    description: "Quote must be accepted and contain custom quoted items."
  })
  @ApiNotFoundResponse({
    description: "Quote request was not found for this customer."
  })
  @ApiUnauthorizedResponse({
    description: "Customer access token is missing or invalid."
  })
  convertMyQuoteToOrder(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.quoteRequestsService.convertCustomerQuoteToOrder(
      getCustomerId(request),
      id
    );
  }
}

@ApiBearerAuth()
@ApiTags("Admin quote requests")
@Controller("admin/quote-requests")
@UseGuards(AdminJwtGuard, PermissionGuard)
export class AdminQuoteRequestsController {
  constructor(private readonly quoteRequestsService: QuoteRequestsService) {}

  @Get()
  @RequirePermission(PermissionCode.SettingsManage)
  @ApiOperation({ summary: "List bulk quote requests for admin follow-up." })
  @ApiOkResponse({
    description: "Quote requests returned.",
    type: QuoteRequestListResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  listQuoteRequests(@Query() query: QuoteRequestListQueryDto) {
    return this.quoteRequestsService.listAdminQuoteRequests(query);
  }

  @Patch(":id/quotation")
  @RequirePermission(PermissionCode.SettingsManage)
  @ApiOperation({ summary: "Send an itemized quotation response to the customer." })
  @ApiOkResponse({
    description: "Quote response saved.",
    type: QuoteRequestResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  sendQuotation(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: SendQuoteResponseDto
  ) {
    return this.quoteRequestsService.sendAdminQuotation(id, body);
  }

  @Patch(":id/status")
  @RequirePermission(PermissionCode.SettingsManage)
  @ApiOperation({ summary: "Update a quote request follow-up status." })
  @ApiOkResponse({
    description: "Quote request status updated.",
    type: QuoteRequestResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  updateQuoteRequestStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateQuoteRequestStatusDto
  ) {
    return this.quoteRequestsService.updateAdminQuoteRequestStatus(id, body);
  }
}

function getCustomerId(request: AuthenticatedRequest) {
  if (!request.auth) {
    throw new UnauthorizedException("Customer access token is missing or invalid.");
  }

  return request.auth.sub;
}
