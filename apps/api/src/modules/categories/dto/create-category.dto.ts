import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  Min
} from "class-validator";

export class CreateCategoryDto {
  @ApiPropertyOptional({
    example: "Essential surgical instruments and supplies."
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({
    example: "https://cdn.example.com/categories/surgical-instruments.png"
  })
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  @MaxLength(2048)
  imageUrl?: string | null;

  @ApiPropertyOptional({
    default: true,
    example: true
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    example: "Surgical Instruments"
  })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    description: "Parent category id for nested category trees.",
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
    nullable: true
  })
  @IsOptional()
  @IsUUID("4")
  parentId?: string | null;

  @ApiProperty({
    description: "Stable URL slug used by public category routes.",
    example: "surgical-instruments"
  })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(160)
  slug!: string;

  @ApiPropertyOptional({
    default: 0,
    example: 10,
    minimum: 0
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
