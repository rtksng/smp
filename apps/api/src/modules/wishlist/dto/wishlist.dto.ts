import { IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class WishlistItemDto {
  @ApiProperty({ example: "product-id" })
  @IsUUID()
  productId!: string;
}
