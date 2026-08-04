import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export const ADMIN_PRODUCT_FEEDBACK_TYPES = ["REVIEW", "QUESTION"] as const;
export type AdminProductFeedbackType =
  (typeof ADMIN_PRODUCT_FEEDBACK_TYPES)[number];
export const PRODUCT_REVIEW_MODERATION_STATUSES = [
  "PENDING_REVIEW",
  "PUBLISHED",
  "REJECTED",
  "HIDDEN"
] as const;
export const PRODUCT_QUESTION_MODERATION_STATUSES = [
  "PENDING",
  "HIDDEN"
] as const;
export const ADMIN_PRODUCT_FEEDBACK_STATUSES = [
  "PENDING_REVIEW",
  "PENDING",
  "ANSWERED",
  "PUBLISHED",
  "REJECTED",
  "HIDDEN"
] as const;
export type ProductReviewModerationStatus =
  (typeof PRODUCT_REVIEW_MODERATION_STATUSES)[number];
export type ProductQuestionModerationStatus =
  (typeof PRODUCT_QUESTION_MODERATION_STATUSES)[number];

export class CreateProductReviewDto {
  @ApiProperty({ example: 5, maximum: 5, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ example: "Reliable purchase", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string | null;

  @ApiProperty({ example: "Arrived in good condition and matched the SKU." })
  @IsString()
  @MaxLength(1200)
  comment!: string;
}

export class CreateProductQuestionDto {
  @ApiProperty({ example: "Is this available in a sterile pack of 20?" })
  @IsString()
  @MaxLength(800)
  question!: string;
}

export class AnswerProductQuestionDto {
  @ApiProperty({ example: "Yes, select the box variant before checkout." })
  @IsString()
  @MaxLength(1200)
  answer!: string;
}

export class ModerateProductReviewDto {
  @ApiProperty({
    enum: PRODUCT_REVIEW_MODERATION_STATUSES,
    example: "PUBLISHED"
  })
  @IsIn(PRODUCT_REVIEW_MODERATION_STATUSES)
  status!: ProductReviewModerationStatus;

  @ApiPropertyOptional({
    example: "Verified purchase review and language is safe.",
    nullable: true
  })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  moderationNote?: string | null;
}

export class ModerateProductQuestionDto {
  @ApiProperty({
    enum: PRODUCT_QUESTION_MODERATION_STATUSES,
    example: "HIDDEN"
  })
  @IsIn(PRODUCT_QUESTION_MODERATION_STATUSES)
  status!: ProductQuestionModerationStatus;

  @ApiPropertyOptional({
    example: "Question no longer applies to the current SKU.",
    nullable: true
  })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  moderationNote?: string | null;
}

export class AdminProductFeedbackListQueryDto {
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

  @ApiPropertyOptional({ enum: ADMIN_PRODUCT_FEEDBACK_TYPES, example: "QUESTION" })
  @IsIn(ADMIN_PRODUCT_FEEDBACK_TYPES)
  @IsOptional()
  type?: AdminProductFeedbackType;

  @ApiPropertyOptional({ enum: ADMIN_PRODUCT_FEEDBACK_STATUSES, example: "PENDING" })
  @IsOptional()
  @IsIn(ADMIN_PRODUCT_FEEDBACK_STATUSES)
  status?: string;

  @ApiPropertyOptional({ example: "product-id" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  productId?: string;

  @ApiPropertyOptional({ example: "forceps" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  productSearch?: string;
}

export class ProductReviewResponseDto {
  @ApiProperty({ example: "review-id" })
  id!: string;

  @ApiProperty({ example: 5 })
  rating!: number;

  @ApiProperty({ example: "Reliable purchase", nullable: true })
  title!: string | null;

  @ApiProperty({ example: "Arrived in good condition and matched the SKU." })
  comment!: string;

  @ApiProperty({ example: "Customer" })
  customerName!: string;

  @ApiProperty({ example: "2026-06-15T10:00:00.000Z" })
  createdAt!: Date;
}

export class ProductQuestionResponseDto {
  @ApiProperty({ example: "question-id" })
  id!: string;

  @ApiProperty({ example: "Is this available in a sterile pack of 20?" })
  question!: string;

  @ApiProperty({ example: "Yes, select the box variant before checkout.", nullable: true })
  answer!: string | null;

  @ApiProperty({ example: "Customer" })
  customerName!: string;

  @ApiProperty({ example: "PENDING" })
  status!: string;

  @ApiProperty({ example: "2026-06-15T10:00:00.000Z" })
  createdAt!: Date;
}

export class ProductFeedbackResponseDto {
  @ApiProperty({ type: [ProductQuestionResponseDto] })
  questions!: ProductQuestionResponseDto[];

  @ApiProperty({ type: [ProductReviewResponseDto] })
  reviews!: ProductReviewResponseDto[];
}

export class AdminProductFeedbackItemDto {
  @ApiProperty({ example: "feedback-id" })
  id!: string;

  @ApiProperty({ enum: ADMIN_PRODUCT_FEEDBACK_TYPES, example: "QUESTION" })
  type!: AdminProductFeedbackType;

  @ApiProperty({ example: "PENDING" })
  status!: string;

  @ApiProperty({ example: "product-id" })
  productId!: string;

  @ApiProperty({ example: "SurgiPro Artery Forceps" })
  productName!: string;

  @ApiProperty({ example: "Customer" })
  customerName!: string;

  @ApiProperty({ example: "2026-06-15T10:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: 5, nullable: true })
  rating!: number | null;

  @ApiProperty({ example: "Reliable purchase", nullable: true })
  title!: string | null;

  @ApiProperty({
    example: "Arrived in good condition and matched the SKU.",
    nullable: true
  })
  comment!: string | null;

  @ApiProperty({
    example: "Is this available in a sterile pack of 20?",
    nullable: true
  })
  question!: string | null;

  @ApiProperty({
    example: "Yes, select the box variant before checkout.",
    nullable: true
  })
  answer!: string | null;

  @ApiProperty({
    example: "Verified purchase review and language is safe.",
    nullable: true
  })
  moderationNote!: string | null;

  @ApiProperty({ example: "2026-06-15T10:00:00.000Z", nullable: true })
  moderatedAt!: string | null;
}

export class AdminProductFeedbackPaginationDto {
  @ApiProperty({ example: false })
  hasNextPage!: boolean;

  @ApiProperty({ example: false })
  hasPreviousPage!: boolean;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class AdminProductFeedbackListResponseDto {
  @ApiProperty({ type: [AdminProductFeedbackItemDto] })
  items!: AdminProductFeedbackItemDto[];

  @ApiProperty({ type: AdminProductFeedbackPaginationDto })
  pagination!: AdminProductFeedbackPaginationDto;
}
