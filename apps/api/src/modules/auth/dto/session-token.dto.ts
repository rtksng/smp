import { ApiProperty } from "@nestjs/swagger";
import { IsJWT } from "class-validator";

export class RefreshTokenDto {
  @ApiProperty({
    description: "Refresh JWT issued by the matching auth surface.",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  })
  @IsJWT()
  refreshToken!: string;
}

export class LogoutDto extends RefreshTokenDto {}
