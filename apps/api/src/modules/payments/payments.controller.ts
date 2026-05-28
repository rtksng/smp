import {
  Body,
  Controller,
  Headers,
  Post,
  RawBody,
  Req,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import type { AuthenticatedRequest } from "../auth/guards/authenticated-request";
import { CustomerJwtGuard } from "../auth/guards/customer-jwt.guard";
import {
  CreateRazorpayOrderDto,
  RazorpayCreateOrderResponseDto,
  RazorpayVerifyResponseDto,
  RazorpayWebhookResponseDto,
  VerifyRazorpayPaymentDto
} from "./dto/payment.dto";
import { PaymentsService } from "./payments.service";

@ApiTags("Payments")
@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("razorpay/create-order")
  @UseGuards(CustomerJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create or reuse a Razorpay order for an online order." })
  @ApiCreatedResponse({
    description: "Razorpay order details returned.",
    type: RazorpayCreateOrderResponseDto
  })
  @ApiBadRequestResponse({ description: "Order is not payable online." })
  @ApiConflictResponse({ description: "Order payment has already succeeded." })
  @ApiNotFoundResponse({ description: "Order was not found for this customer." })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  createRazorpayOrder(
    @Body() body: CreateRazorpayOrderDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.paymentsService.createRazorpayOrder(
      getCustomerId(request),
      body
    );
  }

  @Post("razorpay/verify")
  @UseGuards(CustomerJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Verify Razorpay payment signature and mark payment paid." })
  @ApiOkResponse({
    description: "Razorpay payment verified and order payment status updated.",
    type: RazorpayVerifyResponseDto
  })
  @ApiBadRequestResponse({ description: "Payment ids, amount, or order state is invalid." })
  @ApiConflictResponse({ description: "Payment has already succeeded." })
  @ApiNotFoundResponse({ description: "Order was not found for this customer." })
  @ApiUnauthorizedResponse({ description: "Customer token or Razorpay signature is invalid." })
  verifyRazorpayPayment(
    @Body() body: VerifyRazorpayPaymentDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.paymentsService.verifyRazorpayPayment(
      getCustomerId(request),
      body
    );
  }

  @Post("razorpay/webhook")
  @ApiOperation({ summary: "Receive a Razorpay webhook after signature verification." })
  @ApiHeader({
    description: "Razorpay webhook signature generated over the raw request body.",
    name: "x-razorpay-signature",
    required: true
  })
  @ApiBody({ description: "Raw Razorpay webhook JSON payload." })
  @ApiOkResponse({
    description: "Webhook accepted.",
    type: RazorpayWebhookResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Razorpay webhook signature is invalid." })
  handleRazorpayWebhook(
    @RawBody() rawBody: Buffer | undefined,
    @Body() body: unknown,
    @Headers("x-razorpay-signature") signature: string | undefined
  ) {
    if (!rawBody) {
      throw new UnauthorizedException("Razorpay raw webhook body is missing.");
    }

    return this.paymentsService.handleRazorpayWebhook(rawBody, body, signature);
  }
}

function getCustomerId(request: AuthenticatedRequest) {
  if (!request.auth) {
    throw new UnauthorizedException("Customer access token is missing or invalid.");
  }

  return request.auth.sub;
}

export type RazorpayWebhookRequest = RawBodyRequest<Request>;
