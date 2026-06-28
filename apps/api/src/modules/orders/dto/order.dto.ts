import { Type } from "class-transformer";
import {
  IsEnum,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  DeliveryStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus
} from "../../../generated/prisma/enums";

export class CreateOrderDto {
  @ApiProperty({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6"
  })
  @IsUUID()
  shippingAddressId!: string;

  @ApiPropertyOptional({
    example: "c4f090ce-b5d6-4a9e-89c7-7fa45343c30b",
    nullable: true
  })
  @IsOptional()
  @IsUUID()
  billingAddressId?: string | null;

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.COD
  })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({
    example: "SURGICAL10",
    nullable: true
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  couponCode?: string | null;

  @ApiPropertyOptional({
    description:
      "Stable client-generated key used to make checkout retries idempotent.",
    example: "checkout-20260627-001",
    nullable: true
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  idempotencyKey?: string | null;
}

export class OrderListQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, maximum: 100, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class AdminOrderListQueryDto extends OrderListQueryDto {
  @ApiPropertyOptional({
    enum: OrderStatus,
    example: OrderStatus.CONFIRMED
  })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiPropertyOptional({
    enum: PaymentStatus,
    example: PaymentStatus.PAID
  })
  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({
    example: "2026-05-01"
  })
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({
    example: "2026-05-26"
  })
  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @ApiPropertyOptional({
    example: "9999999999"
  })
  @IsOptional()
  @IsString()
  customerMobile?: string;

  @ApiPropertyOptional({
    example: "ORD-20260525"
  })
  @IsOptional()
  @IsString()
  orderNumber?: string;

  @ApiPropertyOptional({
    example: "2a5d29bc-8dc8-4de0-87d0-e4e6042ce5cc"
  })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class AdminReturnRequestListQueryDto extends OrderListQueryDto {
  @ApiPropertyOptional({
    enum: RefundStatus,
    example: RefundStatus.PENDING
  })
  @IsEnum(RefundStatus)
  @IsOptional()
  status?: RefundStatus;

  @ApiPropertyOptional({
    example: "9999999999"
  })
  @IsOptional()
  @IsString()
  customerMobile?: string;

  @ApiPropertyOptional({
    example: "ORD-20260525"
  })
  @IsOptional()
  @IsString()
  orderNumber?: string;

  @ApiPropertyOptional({
    example: "2a5d29bc-8dc8-4de0-87d0-e4e6042ce5cc"
  })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: OrderStatus,
    example: OrderStatus.PACKED
  })
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ApiPropertyOptional({
    example: "Packed and ready for assignment."
  })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CancelOrderDto {
  @ApiPropertyOptional({
    example: "Customer requested cancellation before dispatch."
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RequestReturnDto {
  @ApiPropertyOptional({
    example: "Wrong item size for the requested procedure set."
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdminReturnActionDto {
  @ApiPropertyOptional({
    example: "Returned item received by warehouse."
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class OrderTotalsResponseDto {
  @ApiProperty({ example: 0 })
  deliveryCharge!: number;

  @ApiProperty({ example: 0 })
  discount!: number;

  @ApiProperty({ example: 283.2 })
  grandTotal!: number;

  @ApiProperty({ example: 240 })
  subtotal!: number;

  @ApiProperty({ example: 43.2 })
  tax!: number;
}

export class OrderAddressResponseDto {
  @ApiProperty({ example: "Delhi" })
  city!: string;

  @ApiProperty({ example: "India" })
  country!: string;

  @ApiProperty({ example: "Ritika Singh" })
  fullName!: string;

  @ApiProperty({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  id!: string;

  @ApiProperty({ example: "Clinic Road" })
  line1!: string;

  @ApiProperty({ example: "Near metro", nullable: true })
  line2!: string | null;

  @ApiProperty({ example: "9999999999" })
  mobileNumber!: string;

  @ApiProperty({ example: "110001" })
  pincode!: string;

  @ApiProperty({ example: "Delhi" })
  state!: string;
}

export class OrderCustomerResponseDto {
  @ApiPropertyOptional({ example: "Ritika Surgical Clinic", nullable: true })
  businessName!: string | null;

  @ApiPropertyOptional({ example: "ritika@example.com", nullable: true })
  email!: string | null;

  @ApiProperty({ example: "Ritika" })
  firstName!: string;

  @ApiPropertyOptional({ example: "27ABCDE1234F1Z5", nullable: true })
  gstNumber!: string | null;

  @ApiProperty({ example: "customer-id" })
  id!: string;

  @ApiPropertyOptional({ example: "Singh", nullable: true })
  lastName!: string | null;

  @ApiProperty({ example: "9999999999" })
  mobileNumber!: string;
}

export class OrderWarehouseResponseDto {
  @ApiProperty({ example: "DEL-01" })
  code!: string;

  @ApiProperty({ example: "warehouse-id" })
  id!: string;

  @ApiProperty({ example: "Delhi warehouse" })
  name!: string;
}

export class OrderItemResponseDto {
  @ApiProperty({ example: "order-item-id" })
  id!: string;

  @ApiProperty({ example: "Curved Artery Forceps" })
  name!: string;

  @ApiProperty({ example: "product-id", nullable: true })
  productId!: string | null;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ example: "FORCEPS-001" })
  sku!: string;

  @ApiProperty({ example: "batch-id", nullable: true })
  stockBatchId!: string | null;

  @ApiProperty({ example: 43.2 })
  taxAmount!: number;

  @ApiProperty({ example: 18 })
  taxRate!: number;

  @ApiProperty({ example: 283.2 })
  total!: number;

  @ApiProperty({ example: 120 })
  unitPrice!: number;

  @ApiProperty({ example: "variant-id", nullable: true })
  variantId!: string | null;

  @ApiProperty({ example: "warehouse-id", nullable: true })
  warehouseId!: string | null;
}

export class OrderStatusHistoryResponseDto {
  @ApiProperty({ example: "admin-id", nullable: true })
  changedById!: string | null;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "history-id" })
  id!: string;

  @ApiProperty({ example: "Packed by warehouse team.", nullable: true })
  note!: string | null;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.CREATED })
  status!: OrderStatus;
}

export class OrderPaymentDetailResponseDto {
  @ApiProperty({ example: 283.2 })
  amount!: number;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "payment-id" })
  id!: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.COD })
  method!: PaymentMethod;

  @ApiPropertyOptional({ example: "2026-05-25T10:05:00.000Z", nullable: true })
  paidAt!: Date | null;

  @ApiPropertyOptional({ example: "razorpay", nullable: true })
  provider!: string | null;

  @ApiPropertyOptional({ example: "order_RZP123", nullable: true })
  providerOrderId!: string | null;

  @ApiPropertyOptional({ example: "pay_RZP123", nullable: true })
  providerPaymentId!: string | null;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.PENDING })
  status!: PaymentStatus;

  @ApiPropertyOptional({ example: "COD-order-1", nullable: true })
  transactionRef!: string | null;
}

export class OrderRefundResponseDto {
  @ApiProperty({ example: 283.2 })
  amount!: number;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "refund-id" })
  id!: string;

  @ApiPropertyOptional({ example: "rfnd_razorpay_1", nullable: true })
  providerRefundId!: string | null;

  @ApiProperty({ example: "Customer requested return.", nullable: true })
  reason!: string | null;

  @ApiProperty({ enum: RefundStatus, example: RefundStatus.PENDING })
  status!: RefundStatus;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z", nullable: true })
  processedAt!: Date | null;
}

export class OrderDeliveryTrackingHistoryResponseDto {
  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "history-id" })
  id!: string;

  @ApiProperty({ example: 28.613939, nullable: true })
  latitude!: number | null;

  @ApiProperty({ example: 77.209023, nullable: true })
  longitude!: number | null;

  @ApiProperty({ example: "Picked up from dispatch bay 2.", nullable: true })
  note!: string | null;

  @ApiProperty({ enum: DeliveryStatus, example: DeliveryStatus.PICKED_UP })
  status!: DeliveryStatus;
}

export class OrderDeliveryTrackingResponseDto {
  @ApiProperty({ example: "assignment-id" })
  id!: string;

  @ApiProperty({ example: "Asha Driver", nullable: true })
  deliveryPartnerName!: string | null;

  @ApiProperty({ example: "DL01AB1234", nullable: true })
  vehicleNumber!: string | null;

  @ApiProperty({ enum: DeliveryStatus, example: DeliveryStatus.ASSIGNED })
  status!: DeliveryStatus;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  assignedAt!: Date;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z", nullable: true })
  pickedUpAt!: Date | null;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z", nullable: true })
  deliveredAt!: Date | null;

  @ApiProperty({
    example: "http://localhost:4000/uploads/proofs/order-1.jpg",
    nullable: true
  })
  proofOfDeliveryUrl!: string | null;

  @ApiProperty({ example: "Clinic was closed.", nullable: true })
  failureReason!: string | null;

  @ApiProperty({ type: [OrderDeliveryTrackingHistoryResponseDto] })
  statusHistory!: OrderDeliveryTrackingHistoryResponseDto[];
}

export class OrderInvoiceTaxBreakupResponseDto {
  @ApiProperty({ example: 21.6 })
  cgst!: number;

  @ApiProperty({ example: 0 })
  igst!: number;

  @ApiProperty({ example: 21.6 })
  sgst!: number;

  @ApiProperty({ example: "CGST_SGST" })
  taxType!: string;
}

export class OrderInvoiceTotalsResponseDto {
  @ApiProperty({ example: 50 })
  deliveryCharge!: number;

  @ApiProperty({ example: 10 })
  discount!: number;

  @ApiProperty({ example: 283.2 })
  grandTotal!: number;

  @ApiProperty({ example: 240 })
  subtotal!: number;

  @ApiProperty({ example: 43.2 })
  tax!: number;
}

export class OrderInvoiceSummaryResponseDto {
  @ApiProperty({ example: "invoice-id" })
  id!: string;

  @ApiProperty({ example: "INV-20260525-ABC12345" })
  invoiceNumber!: string;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  issuedAt!: Date;

  @ApiProperty({ example: "NOT_GENERATED" })
  pdfStatus!: string;

  @ApiProperty({ type: OrderInvoiceTaxBreakupResponseDto })
  taxBreakup!: OrderInvoiceTaxBreakupResponseDto;

  @ApiProperty({ type: OrderInvoiceTotalsResponseDto })
  totals!: OrderInvoiceTotalsResponseDto;
}

export class OrderResponseDto {
  @ApiProperty({ example: "order-id" })
  id!: string;

  @ApiProperty({ example: "ORD-20260525-ABC12345" })
  orderNumber!: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.COD, nullable: true })
  paymentMethod!: PaymentMethod | null;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.PENDING })
  paymentStatus!: PaymentStatus;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.CREATED })
  status!: OrderStatus;

  @ApiProperty({ example: "warehouse-id", nullable: true })
  warehouseId!: string | null;

  @ApiProperty({ type: OrderCustomerResponseDto })
  customer!: OrderCustomerResponseDto;

  @ApiProperty({ type: OrderWarehouseResponseDto, nullable: true })
  warehouse!: OrderWarehouseResponseDto | null;

  @ApiProperty({ type: OrderAddressResponseDto, nullable: true })
  shippingAddress!: OrderAddressResponseDto | null;

  @ApiProperty({ type: OrderAddressResponseDto, nullable: true })
  billingAddress!: OrderAddressResponseDto | null;

  @ApiProperty({ type: [OrderItemResponseDto] })
  items!: OrderItemResponseDto[];

  @ApiProperty({ type: [OrderPaymentDetailResponseDto] })
  paymentDetails!: OrderPaymentDetailResponseDto[];

  @ApiProperty({ type: [OrderRefundResponseDto] })
  refunds!: OrderRefundResponseDto[];

  @ApiProperty({ type: [OrderDeliveryTrackingResponseDto] })
  deliveryTracking!: OrderDeliveryTrackingResponseDto[];

  @ApiProperty({ type: OrderInvoiceSummaryResponseDto, nullable: true })
  invoice!: OrderInvoiceSummaryResponseDto | null;

  @ApiProperty({ type: OrderTotalsResponseDto })
  totals!: OrderTotalsResponseDto;

  @ApiProperty({ type: [OrderStatusHistoryResponseDto] })
  statusHistory!: OrderStatusHistoryResponseDto[];

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z", nullable: true })
  placedAt!: Date | null;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  updatedAt!: Date;
}

export class OrderListResponseDto {
  @ApiProperty({ type: [OrderResponseDto] })
  items!: OrderResponseDto[];
}
