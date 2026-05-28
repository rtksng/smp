import { ApiProperty } from "@nestjs/swagger";
import { PermissionCode } from "../permissions.constants";

export class PermissionResponseDto {
  @ApiProperty({
    description: "Stable permission code used by guards and JWT claims.",
    enum: PermissionCode,
    example: PermissionCode.ProductsRead
  })
  code!: string;

  @ApiProperty({
    example: "View product catalog records."
  })
  description!: string | null;

  @ApiProperty({
    example: "permission-id"
  })
  id!: string;

  @ApiProperty({
    example: "Read products"
  })
  name!: string;
}
