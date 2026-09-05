import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength
} from "class-validator";

const trimText = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
const trimOptionalText = ({ value }: { value: unknown }) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export class CreateBrandDto {
  @ApiPropertyOptional({
    example: "Trusted surgical supplier."
  })
  @IsOptional()
  @IsString()
  @Transform(trimOptionalText)
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
  @Transform(trimOptionalText)
  @MaxLength(2048)
  logoUrl?: string | null;

  @ApiProperty({
    example: "Acme Surgical"
  })
  @IsString()
  @Transform(trimText)
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    description: "Stable URL slug used by public brand routes.",
    example: "acme-surgical"
  })
  @IsString()
  @Transform(trimText)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(160)
  slug!: string;
}
