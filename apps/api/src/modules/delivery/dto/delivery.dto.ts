import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  CashCollectionStatus,
  DeliveryIncidentStatus,
  DeliveryIncidentType,
  DeliveryLedgerEntryType,
  DeliveryPartnerStatus,
  DeliveryStatus
} from "../../../generated/prisma/enums";

export const DELIVERY_DEVICE_PLATFORMS = ["ios", "android"] as const;
export const DELIVERY_ASSIGNMENT_SORTS = ["NEWEST", "OLDEST"] as const;
export type DeliveryDevicePlatform = (typeof DELIVERY_DEVICE_PLATFORMS)[number];

export class DeliveryPartnerListQueryDto {
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

  @ApiPropertyOptional({
    enum: DeliveryPartnerStatus,
    example: DeliveryPartnerStatus.PENDING_VERIFICATION
  })
  @IsEnum(DeliveryPartnerStatus)
  @IsOptional()
  status?: DeliveryPartnerStatus;
}

export class DeliveryAssignmentListQueryDto {
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

  @ApiPropertyOptional({
    enum: DeliveryStatus,
    example: DeliveryStatus.ASSIGNED
  })
  @IsEnum(DeliveryStatus)
  @IsOptional()
  status?: DeliveryStatus;

  @ApiPropertyOptional({
    description: "Search order number, customer, business, or mobile number.",
    example: "ORD-2026"
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ example: "2026-08-01T00:00:00.000Z" })
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({ example: "2026-08-06T23:59:59.999Z" })
  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @ApiPropertyOptional({ enum: DELIVERY_ASSIGNMENT_SORTS, example: "NEWEST" })
  @IsIn(DELIVERY_ASSIGNMENT_SORTS)
  @IsOptional()
  sort?: (typeof DELIVERY_ASSIGNMENT_SORTS)[number];
}

export class AdminDeliveryAssignmentListQueryDto extends DeliveryAssignmentListQueryDto {
  @ApiPropertyOptional({
    description: "Filter assignments by delivery partner.",
    example: "4d36be8a-f271-48f8-a34e-85e3fdcf3421"
  })
  @IsOptional()
  @IsUUID()
  deliveryPartnerId?: string;

  @ApiPropertyOptional({
    description:
      "Filter assignments by pickup warehouse, or the order warehouse when no pickup warehouse is linked.",
    example: "2a5d29bc-8dc8-4de0-87d0-e4e6042ce5cc"
  })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class AssignDeliveryDto {
  @ApiProperty({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6"
  })
  @IsUUID()
  orderId!: string;

  @ApiProperty({
    example: "4d36be8a-f271-48f8-a34e-85e3fdcf3421"
  })
  @IsUUID()
  deliveryPartnerId!: string;

  @ApiPropertyOptional({
    description: "Optional warehouse where the partner should pick up the order.",
    example: "2a5d29bc-8dc8-4de0-87d0-e4e6042ce5cc",
    nullable: true
  })
  @IsOptional()
  @IsUUID()
  pickupWarehouseId?: string | null;

  @ApiPropertyOptional({
    example: "Packed and ready at dispatch dock."
  })
  @IsOptional()
  @IsString()
  note?: string;
}

export class DeliveryPartnerOnlineStatusDto {
  @ApiProperty({
    description: "Current online/offline availability for future mobile dispatch.",
    example: true
  })
  @IsBoolean()
  isOnline!: boolean;
}

export class DeliveryPartnerDeviceDto {
  @ApiProperty({
    enum: DELIVERY_DEVICE_PLATFORMS,
    example: "ios"
  })
  @IsIn(DELIVERY_DEVICE_PLATFORMS)
  platform!: DeliveryDevicePlatform;

  @ApiProperty({
    example: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
  })
  @IsString()
  pushToken!: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  notificationsEnabled?: boolean;
}

export class DeliveryPartnerLocationDto {
  @ApiProperty({ example: 28.613939, maximum: 90, minimum: -90 })
  @Type(() => Number)
  @IsNumber()
  @Max(90)
  @Min(-90)
  latitude!: number;

  @ApiProperty({ example: 77.209023, maximum: 180, minimum: -180 })
  @Type(() => Number)
  @IsNumber()
  @Max(180)
  @Min(-180)
  longitude!: number;
}

export class AddDeliveryPartnerDocumentDto {
  @ApiProperty({
    example: "DRIVING_LICENSE"
  })
  @IsString()
  type!: string;

  @ApiProperty({
    example: "Driving license"
  })
  @IsString()
  title!: string;

  @ApiProperty({
    example: "http://localhost:4000/uploads/license.pdf"
  })
  @IsString()
  fileUrl!: string;

  @ApiProperty({
    example: "delivery-partners/documents/license.pdf"
  })
  @IsString()
  fileKey!: string;
}

export class UpdateDeliveryPartnerProfileDto {
  @ApiPropertyOptional({ example: "Asha Driver" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({ example: "driver@example.com", nullable: true })
  @IsEmail()
  @IsOptional()
  email?: string | null;

  @ApiPropertyOptional({ example: "DL01AB1234", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  vehicleNumber?: string | null;
}

export class RejectDeliveryPartnerDto {
  @ApiPropertyOptional({ example: "Driving licence could not be verified." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CreateDeliveryIncidentDto {
  @ApiProperty({ enum: DeliveryIncidentType })
  @IsEnum(DeliveryIncidentType)
  type!: DeliveryIncidentType;

  @ApiPropertyOptional({ example: "Customer did not answer after three calls." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({ example: "http://localhost:4000/uploads/proofs/incident.jpg" })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ example: "delivery/proofs/incident.jpg" })
  @IsOptional()
  @IsString()
  photoKey?: string;
}

export class UpdateCashSettlementDto {
  @ApiProperty({
    enum: [CashCollectionStatus.SUBMITTED, CashCollectionStatus.SETTLED]
  })
  @IsIn([CashCollectionStatus.SUBMITTED, CashCollectionStatus.SETTLED])
  status!: Extract<CashCollectionStatus, "SUBMITTED" | "SETTLED">;
}

export class CreateDeliveryLedgerEntryDto {
  @ApiProperty({ enum: DeliveryLedgerEntryType })
  @IsEnum(DeliveryLedgerEntryType)
  type!: DeliveryLedgerEntryType;

  @ApiProperty({ example: 250, minimum: 0.01 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9_999_999_999.99)
  amount!: number;

  @ApiProperty({ example: "Delivery earning for weekly settlement" })
  @IsString()
  @MaxLength(300)
  description!: string;

  @ApiPropertyOptional({ example: "PAYOUT-20260806-001" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;
}

export class UpdateDeliveryAssignmentStatusDto {
  @ApiProperty({
    enum: DeliveryStatus,
    example: DeliveryStatus.PICKED_UP
  })
  @IsEnum(DeliveryStatus)
  status!: DeliveryStatus;

  @ApiPropertyOptional({
    example: "Picked up from dispatch bay 2."
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: 28.613939, maximum: 90, minimum: -90 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Max(90)
  @Min(-90)
  latitude?: number;

  @ApiPropertyOptional({ example: 77.209023, maximum: 180, minimum: -180 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Max(180)
  @Min(-180)
  longitude?: number;

  @ApiPropertyOptional({
    description: "Stored file URL placeholder for proof of delivery.",
    example: "http://localhost:4000/uploads/proofs/order-1.jpg"
  })
  @IsOptional()
  @IsString()
  proofOfDeliveryUrl?: string;

  @ApiPropertyOptional({
    description: "Stored object key placeholder for proof of delivery.",
    example: "delivery/proofs/order-1.jpg"
  })
  @IsOptional()
  @IsString()
  proofOfDeliveryKey?: string;

  @ApiPropertyOptional({
    example: "Dr. Nisha Rao"
  })
  @IsOptional()
  @IsString()
  receiverName?: string;

  @ApiPropertyOptional({
    description: "Cash collected from the customer for COD deliveries.",
    example: 1225,
    minimum: 0
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(0)
  @Max(9_999_999_999.99)
  cashCollectedAmount?: number;

  @ApiPropertyOptional({
    example: "Clinic was closed at the delivery attempt."
  })
  @IsOptional()
  @IsString()
  failureReason?: string;
}

export class DeliveryPartnerDocumentResponseDto {
  @ApiProperty({ example: "document-id" })
  id!: string;

  @ApiProperty({ example: "DRIVING_LICENSE" })
  type!: string;

  @ApiProperty({ example: "Driving license" })
  title!: string;

  @ApiProperty({ example: "http://localhost:4000/uploads/license.pdf" })
  fileUrl!: string;

  @ApiProperty({ example: "delivery-partners/documents/license.pdf" })
  fileKey!: string;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z", nullable: true })
  verifiedAt!: Date | null;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  createdAt!: Date;
}

export class DeliveryWalletResponseDto {
  @ApiProperty({ example: 0 })
  balance!: number;

  @ApiProperty({ example: "INR" })
  currency!: "INR";

  @ApiProperty({ example: 0 })
  totalEarnings!: number;
}

export class DeliveryPartnerLocationResponseDto {
  @ApiProperty({ example: 28.613939, nullable: true })
  latitude!: number | null;

  @ApiProperty({ example: 77.209023, nullable: true })
  longitude!: number | null;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z", nullable: true })
  updatedAt!: Date | null;
}

export class DeliveryPartnerResponseDto {
  @ApiProperty({ example: "partner-id" })
  id!: string;

  @ApiProperty({ example: "Asha Driver" })
  fullName!: string;

  @ApiProperty({ example: "+919876543210" })
  mobileNumber!: string;

  @ApiProperty({ example: "driver@example.com", nullable: true })
  email!: string | null;

  @ApiProperty({ example: "DL01AB1234", nullable: true })
  vehicleNumber!: string | null;

  @ApiProperty({ enum: DeliveryPartnerStatus })
  status!: DeliveryPartnerStatus;

  @ApiProperty({ example: "Vehicle document needs to be resubmitted.", nullable: true })
  statusReason!: string | null;

  @ApiProperty({ example: false })
  isOnline!: boolean;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z", nullable: true })
  lastSeenAt!: Date | null;

  @ApiProperty({ type: DeliveryPartnerLocationResponseDto, nullable: true })
  lastKnownLocation!: DeliveryPartnerLocationResponseDto | null;

  @ApiProperty({ type: DeliveryWalletResponseDto })
  wallet!: DeliveryWalletResponseDto;

  @ApiProperty({ type: [DeliveryPartnerDocumentResponseDto] })
  documents!: DeliveryPartnerDocumentResponseDto[];

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  updatedAt!: Date;
}

export class DeliveryPartnerListResponseDto {
  @ApiProperty({ type: [DeliveryPartnerResponseDto] })
  items!: DeliveryPartnerResponseDto[];
}

export class DeliveryPickupWarehouseResponseDto {
  @ApiProperty({ example: "warehouse-id" })
  id!: string;

  @ApiProperty({ example: "Delhi warehouse" })
  name!: string;

  @ApiProperty({ example: "DEL-01" })
  code!: string;

  @ApiProperty({ example: "Warehouse Road" })
  address!: string;

  @ApiProperty({ example: "Delhi" })
  city!: string;

  @ApiProperty({ example: "Delhi" })
  state!: string;

  @ApiProperty({ example: "110001" })
  pincode!: string;

  @ApiProperty({ example: "Dispatch Desk" })
  contactPerson!: string;

  @ApiProperty({ example: "+911145678900" })
  contactNumber!: string;

  @ApiProperty({ example: 28.613939, nullable: true })
  latitude!: number | null;

  @ApiProperty({ example: 77.209023, nullable: true })
  longitude!: number | null;
}

export class DeliveryAssignmentCustomerResponseDto {
  @ApiProperty({ example: "customer-id" })
  id!: string;

  @ApiProperty({ example: "Nisha Rao" })
  fullName!: string;

  @ApiProperty({ example: "+919999888877" })
  mobileNumber!: string;

  @ApiProperty({ example: "Rao Surgical Clinic", nullable: true })
  businessName!: string | null;
}

export class DeliveryAddressResponseDto {
  @ApiProperty({ example: "Dr. Nisha Rao" })
  fullName!: string;

  @ApiProperty({ example: "+919999888877" })
  mobileNumber!: string;

  @ApiProperty({ example: "Clinic 12, Ring Road" })
  line1!: string;

  @ApiProperty({ example: "First floor", nullable: true })
  line2!: string | null;

  @ApiProperty({ example: "Near metro gate 2", nullable: true })
  landmark!: string | null;

  @ApiProperty({ example: "Delhi" })
  city!: string;

  @ApiProperty({ example: "Delhi" })
  state!: string;

  @ApiProperty({ example: "110024" })
  pincode!: string;

  @ApiProperty({ example: "India" })
  country!: string;

  @ApiProperty({ example: 28.62, nullable: true })
  latitude!: number | null;

  @ApiProperty({ example: 77.22, nullable: true })
  longitude!: number | null;
}

export class DeliveryAssignmentItemResponseDto {
  @ApiProperty({ example: "item-id" })
  id!: string;

  @ApiProperty({ example: "GLV-100" })
  sku!: string;

  @ApiProperty({ example: "Sterile gloves" })
  name!: string;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ example: "product-id", nullable: true })
  productId!: string | null;

  @ApiProperty({ example: "variant-id", nullable: true })
  variantId!: string | null;

  @ApiProperty({ example: "warehouse-id", nullable: true })
  warehouseId!: string | null;
}

export class DeliveryAssignmentPaymentResponseDto {
  @ApiProperty({ example: "COD", nullable: true })
  method!: string | null;

  @ApiProperty({ example: "PENDING", nullable: true })
  status!: string | null;

  @ApiProperty({ example: 1225 })
  codAmount!: number;

  @ApiProperty({ example: 1225, nullable: true })
  cashCollectedAmount!: number | null;

  @ApiProperty({ example: "COLLECTED" })
  cashSettlementStatus!: string;
}

export class DeliveryAssignmentTotalsResponseDto {
  @ApiProperty({ example: 1100 })
  subtotal!: number;

  @ApiProperty({ example: 100 })
  taxTotal!: number;

  @ApiProperty({ example: 50 })
  shippingTotal!: number;

  @ApiProperty({ example: 25 })
  discountTotal!: number;

  @ApiProperty({ example: 1225 })
  grandTotal!: number;
}

export class DeliveryAssignmentHistoryResponseDto {
  @ApiProperty({ example: "history-id" })
  id!: string;

  @ApiProperty({ enum: DeliveryStatus })
  status!: DeliveryStatus;

  @ApiProperty({ example: "Picked up from dispatch bay 2.", nullable: true })
  note!: string | null;

  @ApiProperty({ example: 28.613939, nullable: true })
  latitude!: number | null;

  @ApiProperty({ example: 77.209023, nullable: true })
  longitude!: number | null;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  createdAt!: Date;
}

export class DeliveryAssignmentResponseDto {
  @ApiProperty({ example: "assignment-id" })
  id!: string;

  @ApiProperty({ example: "order-id" })
  orderId!: string;

  @ApiProperty({ example: "ORD-20260525-ABC12345" })
  orderNumber!: string;

  @ApiProperty({ example: "partner-id" })
  deliveryPartnerId!: string;

  @ApiProperty({ type: DeliveryPartnerResponseDto, nullable: true })
  deliveryPartner!: DeliveryPartnerResponseDto | null;

  @ApiProperty({ enum: DeliveryStatus })
  status!: DeliveryStatus;

  @ApiProperty({ type: DeliveryAssignmentCustomerResponseDto })
  customer!: DeliveryAssignmentCustomerResponseDto;

  @ApiProperty({ type: DeliveryAddressResponseDto, nullable: true })
  shippingAddress!: DeliveryAddressResponseDto | null;

  @ApiProperty({ type: [DeliveryAssignmentItemResponseDto] })
  items!: DeliveryAssignmentItemResponseDto[];

  @ApiProperty({ type: DeliveryAssignmentPaymentResponseDto })
  payment!: DeliveryAssignmentPaymentResponseDto;

  @ApiProperty({ type: DeliveryAssignmentTotalsResponseDto })
  totals!: DeliveryAssignmentTotalsResponseDto;

  @ApiProperty({ example: "Call before delivery.", nullable: true })
  orderNotes!: string | null;

  @ApiProperty({ example: "warehouse-id", nullable: true })
  pickupWarehouseId!: string | null;

  @ApiProperty({ type: DeliveryPickupWarehouseResponseDto, nullable: true })
  pickupWarehouse!: DeliveryPickupWarehouseResponseDto | null;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  assignedAt!: Date;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z", nullable: true })
  pickedUpAt!: Date | null;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z", nullable: true })
  deliveredAt!: Date | null;

  @ApiProperty({ example: "http://localhost:4000/uploads/proofs/order-1.jpg", nullable: true })
  proofOfDeliveryUrl!: string | null;

  @ApiProperty({ example: "delivery/proofs/order-1.jpg", nullable: true })
  proofOfDeliveryKey!: string | null;

  @ApiProperty({ example: "Clinic was closed.", nullable: true })
  failureReason!: string | null;

  @ApiProperty({ example: "Dr. Nisha Rao", nullable: true })
  receiverName!: string | null;

  @ApiProperty({ type: [DeliveryAssignmentHistoryResponseDto] })
  statusHistory!: DeliveryAssignmentHistoryResponseDto[];

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  updatedAt!: Date;
}

export class DeliveryAssignmentListResponseDto {
  @ApiProperty({ type: [DeliveryAssignmentResponseDto] })
  items!: DeliveryAssignmentResponseDto[];
}

export class DeliveryDashboardResponseDto {
  @ApiProperty({ example: 4 })
  activeCount!: number;

  @ApiProperty({ example: 12 })
  completedCount!: number;

  @ApiProperty({ example: 1 })
  issueCount!: number;

  @ApiProperty({ example: 3250 })
  codToCollect!: number;

  @ApiProperty({ additionalProperties: { type: "number" }, type: "object" })
  statusCounts!: Record<string, number>;
}

export class DeliveryCashItemResponseDto {
  @ApiProperty({ example: "assignment-id" })
  assignmentId!: string;

  @ApiProperty({ example: "ORD-20260806-ABC123" })
  orderNumber!: string;

  @ApiProperty({ example: 1250 })
  amount!: number;

  @ApiProperty({ enum: CashCollectionStatus })
  settlementStatus!: CashCollectionStatus;

  @ApiProperty({ example: "2026-08-06T10:00:00.000Z", nullable: true })
  collectedAt!: Date | null;
}

export class DeliveryCashSummaryResponseDto {
  @ApiProperty({ example: 3250 })
  cashInHand!: number;

  @ApiProperty({ example: 1200 })
  submittedAmount!: number;

  @ApiProperty({ example: 8900 })
  settledAmount!: number;

  @ApiProperty({ example: 3 })
  pendingCount!: number;

  @ApiProperty({ type: DeliveryWalletResponseDto })
  wallet!: DeliveryWalletResponseDto;

  @ApiProperty({ type: [DeliveryCashItemResponseDto] })
  items!: DeliveryCashItemResponseDto[];

  @ApiProperty({ type: () => [DeliveryLedgerEntryResponseDto] })
  ledgerEntries!: DeliveryLedgerEntryResponseDto[];
}

export class DeliveryLedgerEntryResponseDto {
  @ApiProperty({ example: "ledger-entry-id" })
  id!: string;

  @ApiProperty({ enum: DeliveryLedgerEntryType })
  type!: DeliveryLedgerEntryType;

  @ApiProperty({ example: 250 })
  amount!: number;

  @ApiProperty({ example: "Delivery earning" })
  description!: string;

  @ApiProperty({ example: "PAYOUT-20260806-001", nullable: true })
  reference!: string | null;

  @ApiProperty({ example: "2026-08-06T10:00:00.000Z" })
  createdAt!: Date;
}

export class DeliveryNotificationResponseDto {
  @ApiProperty({ example: "notification-id" })
  id!: string;

  @ApiProperty({ example: "New delivery assigned" })
  title!: string;

  @ApiProperty({ example: "Order ORD-20260806-ABC123 is ready." })
  body!: string;

  @ApiProperty({ example: "assignment-id", nullable: true })
  assignmentId!: string | null;

  @ApiProperty({ example: "NEW_ASSIGNMENT" })
  type!: string;

  @ApiProperty({ example: false })
  isRead!: boolean;

  @ApiProperty({ example: "2026-08-06T10:00:00.000Z" })
  createdAt!: Date;
}

export class DeliveryNotificationListResponseDto {
  @ApiProperty({ type: [DeliveryNotificationResponseDto] })
  items!: DeliveryNotificationResponseDto[];

  @ApiProperty({ example: 2 })
  unreadCount!: number;
}

export class DeliveryIncidentResponseDto {
  @ApiProperty({ example: "incident-id" })
  id!: string;

  @ApiProperty({ example: "assignment-id" })
  deliveryAssignmentId!: string;

  @ApiProperty({ enum: DeliveryIncidentType })
  type!: DeliveryIncidentType;

  @ApiProperty({ enum: DeliveryIncidentStatus })
  status!: DeliveryIncidentStatus;

  @ApiProperty({ example: "Customer did not answer.", nullable: true })
  note!: string | null;

  @ApiProperty({ example: "http://localhost:4000/uploads/proofs/incident.jpg", nullable: true })
  photoUrl!: string | null;

  @ApiProperty({ example: "2026-08-06T10:00:00.000Z" })
  createdAt!: Date;
}
