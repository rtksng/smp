import { ApiProperty } from "@nestjs/swagger";
import { PermissionResponseDto } from "../../permissions/dto/permission-response.dto";
import { AdminRoleCode } from "../roles.constants";

export class RoleResponseDto {
  @ApiProperty({
    description: "Stable role code stored on admin users.",
    enum: AdminRoleCode,
    example: AdminRoleCode.InventoryManager
  })
  code!: string;

  @ApiProperty({
    example: "Manages products and inventory across assigned warehouses."
  })
  description!: string | null;

  @ApiProperty({
    example: "role-id"
  })
  id!: string;

  @ApiProperty({
    example: true
  })
  isSystem!: boolean;

  @ApiProperty({
    example: "Inventory manager"
  })
  name!: string;

  @ApiProperty({
    type: [PermissionResponseDto]
  })
  permissions!: PermissionResponseDto[];
}
