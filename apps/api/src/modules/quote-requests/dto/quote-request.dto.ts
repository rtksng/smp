import { Type } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateQuoteRequestDto {
  @ApiProperty({ example: "Dr Asha Rao" })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: "Asha Surgical Clinic", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  organization?: string | null;

  @ApiProperty({ example: "asha@example.com" })
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @ApiProperty({ example: "+919876543210" })
  @IsString()
  @MaxLength(24)
  mobileNumber!: string;

  @ApiProperty({ example: "Need 20 forceps and 8 draping kits for Mumbai." })
  @IsString()
  @MaxLength(2000)
  message!: string;
}

export class QuoteRequestResponseDto {
  @ApiProperty({ example: "quote-request-id" })
  id!: string;

  @ApiProperty({ example: "NEW" })
  status!: string;

  @ApiProperty({ example: "2026-06-15T10:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "Dr Asha Rao" })
  name!: string;

  @ApiProperty({ example: "Asha Surgical Clinic", nullable: true })
  organization!: string | null;

  @ApiProperty({ example: "asha@example.com" })
  email!: string;

  @ApiProperty({ example: "+919876543210" })
  mobileNumber!: string;

  @ApiProperty({ example: "Need 20 forceps and 8 draping kits for Mumbai." })
  message!: string;
}

export class QuoteRequestListQueryDto {
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

  @ApiPropertyOptional({ example: "NEW" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: string;
}

export class UpdateQuoteRequestStatusDto {
  @ApiProperty({ enum: ["NEW", "CONTACTED", "CLOSED"] })
  @IsIn(["NEW", "CONTACTED", "CLOSED"])
  status!: "NEW" | "CONTACTED" | "CLOSED";
}

export class QuoteRequestListResponseDto {
  @ApiProperty({ type: [QuoteRequestResponseDto] })
  items!: QuoteRequestResponseDto[];
}
