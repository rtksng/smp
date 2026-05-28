import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsUUID } from "class-validator";
import {
  OrderStatus,
  PaymentStatus
} from "../../../generated/prisma/enums";

export class CreateRazorpayOrderDto {
  @ApiProperty({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6"
  })
  @IsUUID()
  orderId!: string;
}

export class VerifyRazorpayPaymentDto {
  @ApiProperty({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6"
  })
  @IsUUID()
  orderId!: string;

  @ApiProperty({
    example: "order_NwR3xQnJpL9iYk"
  })
  @IsString()
  razorpay_order_id!: string;

  @ApiProperty({
    example: "pay_NwR7fH2eKj8LmN"
  })
  @IsString()
  razorpay_payment_id!: string;

  @ApiProperty({
    example: "4f2f9b0a7c0f05fb6d0e8a3f0c22f2bbf915ec5f6ad236a40f0bb8e03d3b4c18"
  })
  @IsString()
  razorpay_signature!: string;
}

export class RazorpayOrderGatewayResponseDto {
  @ApiProperty({ example: 28320 })
  amount!: number;

  @ApiProperty({ example: "INR" })
  currency!: string;

  @ApiProperty({ example: "rzp_test_xxxxxxxxxx" })
  keyId!: string;

  @ApiProperty({ example: "order_NwR3xQnJpL9iYk" })
  orderId!: string;
}

export class RazorpayCreateOrderResponseDto {
  @ApiProperty({ example: "order-id" })
  orderId!: string;

  @ApiProperty({ example: "payment-id" })
  paymentId!: string;

  @ApiProperty({ type: RazorpayOrderGatewayResponseDto })
  razorpay!: RazorpayOrderGatewayResponseDto;
}

export class RazorpayVerifyResponseDto {
  @ApiProperty({ enum: OrderStatus, example: OrderStatus.CONFIRMED })
  orderStatus!: OrderStatus;

  @ApiProperty({ example: "payment-id" })
  paymentId!: string;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.PAID })
  paymentStatus!: PaymentStatus;
}

export class RazorpayWebhookResponseDto {
  @ApiProperty({ example: true })
  queued!: boolean;

  @ApiProperty({ example: false, required: false })
  duplicate?: boolean;

  @ApiProperty({ example: true, required: false })
  processed?: boolean;

  @ApiProperty({ example: true })
  received!: boolean;
}
