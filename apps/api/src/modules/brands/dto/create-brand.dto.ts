import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength
} from "class-validator";

export class CreateBrandDto {
  @ApiPropertyOptional({
    example: "Trusted surgical supplier."
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({
    default: true,
    example: true
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: "https://cdn.example.com/brands/acme-surgical.svg"
  })
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  @MaxLength(2048)
  logoUrl?: string | null;

  @ApiProperty({
    example: "Acme Surgical"
  })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    description: "Stable URL slug used by public brand routes.",
    example: "acme-surgical"
  })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(160)
  slug!: string;
}
