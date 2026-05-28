import { ApiProperty } from "@nestjs/swagger";

export class BrandResponseDto {
  @ApiProperty({
    example: "Trusted surgical supplier."
  })
  description!: string | null;

  @ApiProperty({
    example: "brand-id"
  })
  id!: string;

  @ApiProperty({
    example: true
  })
  isActive!: boolean;

  @ApiProperty({
    example: "https://cdn.example.com/brands/acme-surgical.svg"
  })
  logoUrl!: string | null;

  @ApiProperty({
    example: "Acme Surgical"
  })
  name!: string;

  @ApiProperty({
    example: "acme-surgical"
  })
  slug!: string;
}
