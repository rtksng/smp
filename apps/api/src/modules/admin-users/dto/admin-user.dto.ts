import { Transform, Type } from "class-transformer";
import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AdminStatus } from "../../../generated/prisma/enums";
import { AdminRoleCode } from "../../roles/roles.constants";

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

function trimNullableString(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : value;
}

export class AdminUserListQueryDto {
  @ApiPropertyOptional({ default: 50, maximum: 100, minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ enum: AdminRoleCode, example: AdminRoleCode.OrderManager })
  @IsOptional()
  @IsEnum(AdminRoleCode)
  roleCode?: AdminRoleCode;

  @ApiPropertyOptional({ example: "ops@example.com" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ enum: AdminStatus, example: AdminStatus.ACTIVE })
  @IsOptional()
  @IsEnum(AdminStatus)
  status?: AdminStatus;
}

export class CreateAdminUserDto {
  @ApiProperty({ example: "ops@example.com" })
  @Transform(({ value }: { value: unknown }) => normalizeEmail(value))
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: "Ops" })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  firstName!: string;

  @ApiPropertyOptional({ example: "Manager", nullable: true })
  @Transform(({ value }: { value: unknown }) => trimNullableString(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string | null;

  @ApiPropertyOptional({ example: "+919876543210", nullable: true })
  @Transform(({ value }: { value: unknown }) => trimNullableString(value))
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  mobileNumber?: string | null;

  @ApiProperty({ example: "StrongPass123" })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsUUID("4")
  roleId!: string;

  @ApiPropertyOptional({ default: AdminStatus.ACTIVE, enum: AdminStatus })
  @IsOptional()
  @IsEnum(AdminStatus)
  status?: AdminStatus;
}

export class UpdateAdminUserDto {
  @ApiPropertyOptional({ example: "ops@example.com" })
  @Transform(({ value }: { value: unknown }) => normalizeEmail(value))
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ example: "Ops" })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  firstName?: string;

  @ApiPropertyOptional({ example: "Manager", nullable: true })
  @Transform(({ value }: { value: unknown }) => trimNullableString(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string | null;

  @ApiPropertyOptional({ example: "+919876543210", nullable: true })
  @Transform(({ value }: { value: unknown }) => trimNullableString(value))
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  mobileNumber?: string | null;

  @ApiPropertyOptional({ example: "StrongPass123" })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsOptional()
  @IsUUID("4")
  roleId?: string;

  @ApiPropertyOptional({ enum: AdminStatus, example: AdminStatus.ACTIVE })
  @IsOptional()
  @IsEnum(AdminStatus)
  status?: AdminStatus;
}

export class AdminUserRoleResponseDto {
  @ApiProperty({ enum: AdminRoleCode, example: AdminRoleCode.OrderManager })
  code!: string;

  @ApiProperty({ example: "role-id" })
  id!: string;

  @ApiProperty({ example: "Order manager" })
  name!: string;
}

export class AdminUserResponseDto {
  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "ops@example.com" })
  email!: string;

  @ApiProperty({ example: "Ops" })
  firstName!: string;

  @ApiProperty({ example: "admin-id" })
  id!: string;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z", nullable: true })
  lastLoginAt!: Date | null;

  @ApiProperty({ example: "Manager", nullable: true })
  lastName!: string | null;

  @ApiProperty({ example: "+919876543210", nullable: true })
  mobileNumber!: string | null;

  @ApiProperty({ type: AdminUserRoleResponseDto })
  role!: AdminUserRoleResponseDto;

  @ApiProperty({ example: "role-id" })
  roleId!: string;

  @ApiProperty({ enum: AdminStatus, example: AdminStatus.ACTIVE })
  status!: AdminStatus;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  updatedAt!: Date;
}

export class AdminUserPaginationResponseDto {
  @ApiProperty({ example: false })
  hasNextPage!: boolean;

  @ApiProperty({ example: false })
  hasPreviousPage!: boolean;

  @ApiProperty({ example: 50 })
  limit!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class AdminUserListResponseDto {
  @ApiProperty({ type: [AdminUserResponseDto] })
  items!: AdminUserResponseDto[];

  @ApiProperty({ type: AdminUserPaginationResponseDto })
  pagination!: AdminUserPaginationResponseDto;
}
