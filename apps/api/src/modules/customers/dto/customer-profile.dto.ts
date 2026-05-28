import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";

export const CustomerAddressType = {
  CLINIC: "CLINIC",
  HOME: "HOME",
  HOSPITAL: "HOSPITAL",
  OTHER: "OTHER",
  WORK: "WORK"
} as const;

export type CustomerAddressType =
  (typeof CustomerAddressType)[keyof typeof CustomerAddressType];

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

function trimNullableString(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? null : trimmed;
}

function trimNullableUppercaseString(value: unknown) {
  const trimmed = trimNullableString(value);

  return typeof trimmed === "string" ? trimmed.toUpperCase() : trimmed;
}

export class UpdateCustomerProfileDto {
  @ApiPropertyOptional({
    example: "Rao Medical Supplies",
    nullable: true
  })
  @Transform(({ value }: { value: unknown }) => trimNullableString(value))
  @IsOptional()
  @IsString()
  @MaxLength(160)
  businessName?: string | null;

  @ApiPropertyOptional({
    example: "billing@example.com",
    nullable: true
  })
  @Transform(({ value }: { value: unknown }) => trimNullableString(value))
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({
    description: "Indian GSTIN for invoice billing.",
    example: "27ABCDE1234F1Z5",
    nullable: true
  })
  @Transform(({ value }: { value: unknown }) =>
    trimNullableUppercaseString(value)
  )
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/)
  gstNumber?: string | null;

  @ApiPropertyOptional({
    example: "Dr Asha Rao"
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;
}

export class CustomerProfileResponseDto {
  @ApiProperty({
    example: "Rao Medical Supplies",
    nullable: true
  })
  businessName!: string | null;

  @ApiProperty({
    example: "billing@example.com",
    nullable: true
  })
  email!: string | null;

  @ApiProperty({
    example: "27ABCDE1234F1Z5",
    nullable: true
  })
  gstNumber!: string | null;

  @ApiProperty({
    example: "customer-id"
  })
  id!: string;

  @ApiProperty({
    example: "+919876543210"
  })
  mobileNumber!: string;

  @ApiProperty({
    example: "Dr Asha Rao"
  })
  name!: string;
}

export class CreateCustomerAddressDto {
  @ApiProperty({ example: "12 Surgical Street" })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(500)
  addressLine1!: string;

  @ApiPropertyOptional({ example: "Floor 3", nullable: true })
  @Transform(({ value }: { value: unknown }) => trimNullableString(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressLine2?: string | null;

  @ApiProperty({ example: "Mumbai" })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(120)
  city!: string;

  @ApiProperty({ example: "Dr Asha Rao" })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(160)
  fullName!: string;

  @ApiPropertyOptional({ example: "Near City Hospital", nullable: true })
  @Transform(({ value }: { value: unknown }) => trimNullableString(value))
  @IsOptional()
  @IsString()
  @MaxLength(160)
  landmark?: string | null;

  @ApiPropertyOptional({ example: 19.076, maximum: 90, minimum: -90, nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @ApiPropertyOptional({ example: 72.8777, maximum: 180, minimum: -180, nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @ApiProperty({ example: "+919876543210" })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone!: string;

  @ApiProperty({ example: "400001" })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @Matches(/^[0-9]{6}$/)
  pincode!: string;

  @ApiProperty({ example: "Maharashtra" })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(120)
  state!: string;

  @ApiProperty({
    enum: CustomerAddressType,
    example: CustomerAddressType.CLINIC
  })
  @IsEnum(CustomerAddressType)
  type!: CustomerAddressType;
}

export class UpdateCustomerAddressDto {
  @ApiPropertyOptional({ example: "12 Surgical Street" })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressLine1?: string;

  @ApiPropertyOptional({ example: "Floor 3", nullable: true })
  @Transform(({ value }: { value: unknown }) => trimNullableString(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressLine2?: string | null;

  @ApiPropertyOptional({ example: "Mumbai" })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: "Dr Asha Rao" })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string;

  @ApiPropertyOptional({ example: "Near City Hospital", nullable: true })
  @Transform(({ value }: { value: unknown }) => trimNullableString(value))
  @IsOptional()
  @IsString()
  @MaxLength(160)
  landmark?: string | null;

  @ApiPropertyOptional({ example: 19.076, maximum: 90, minimum: -90, nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @ApiPropertyOptional({ example: 72.8777, maximum: 180, minimum: -180, nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @ApiPropertyOptional({ example: "+919876543210" })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone?: string;

  @ApiPropertyOptional({ example: "400001" })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{6}$/)
  pincode?: string;

  @ApiPropertyOptional({ example: "Maharashtra" })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @ApiPropertyOptional({
    enum: CustomerAddressType,
    example: CustomerAddressType.CLINIC
  })
  @IsOptional()
  @IsEnum(CustomerAddressType)
  type?: CustomerAddressType;
}

export class CustomerAddressResponseDto {
  @ApiProperty({ example: "12 Surgical Street" })
  addressLine1!: string;

  @ApiProperty({ example: "Floor 3", nullable: true })
  addressLine2!: string | null;

  @ApiProperty({ example: "Mumbai" })
  city!: string;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "Dr Asha Rao" })
  fullName!: string;

  @ApiProperty({ example: "address-id" })
  id!: string;

  @ApiProperty({ example: true })
  isDefault!: boolean;

  @ApiProperty({ example: "Near City Hospital", nullable: true })
  landmark!: string | null;

  @ApiProperty({ example: 19.076, nullable: true })
  latitude!: number | null;

  @ApiProperty({ example: 72.8777, nullable: true })
  longitude!: number | null;

  @ApiProperty({ example: "+919876543210" })
  phone!: string;

  @ApiProperty({ example: "400001" })
  pincode!: string;

  @ApiProperty({ example: "Maharashtra" })
  state!: string;

  @ApiProperty({
    enum: CustomerAddressType,
    example: CustomerAddressType.CLINIC
  })
  type!: CustomerAddressType;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  updatedAt!: Date;
}
