import { ApiProperty } from "@nestjs/swagger";

export class CategoryResponseDto {
  @ApiProperty({
    type: () => [CategoryResponseDto]
  })
  children!: CategoryResponseDto[];

  @ApiProperty({
    example: "Essential surgical instruments and supplies."
  })
  description!: string | null;

  @ApiProperty({
    example: "category-id"
  })
  id!: string;

  @ApiProperty({
    example: "https://cdn.example.com/categories/surgical-instruments.png"
  })
  imageUrl!: string | null;

  @ApiProperty({
    example: true
  })
  isActive!: boolean;

  @ApiProperty({
    example: "Surgical Instruments"
  })
  name!: string;

  @ApiProperty({
    example: null
  })
  parentId!: string | null;

  @ApiProperty({
    example: "surgical-instruments"
  })
  slug!: string;

  @ApiProperty({
    example: 10
  })
  sortOrder!: number;
}
