import { ApiProperty } from "@nestjs/swagger";

export class UploadResponseDto {
  @ApiProperty({
    example: "catalog/products/images/7d9f8f33-d348-4a89-94e8-907be76a91c6.png"
  })
  key!: string;

  @ApiProperty({ example: "image/png" })
  mimeType!: string;

  @ApiProperty({ example: 204800 })
  size!: number;

  @ApiProperty({
    example:
      "http://localhost:4000/uploads/catalog/products/images/7d9f8f33-d348-4a89-94e8-907be76a91c6.png"
  })
  url!: string;
}
