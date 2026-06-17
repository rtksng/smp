import { ApiProperty } from "@nestjs/swagger";
import { IsJWT, IsOptional } from "class-validator";

export class RefreshTokenDto {
  @ApiProperty({
    description: "Refresh JWT issued by the matching auth surface.",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  })
  @IsJWT()
  refreshToken!: string;
}

export class LogoutDto extends RefreshTokenDto {}

export class OptionalRefreshTokenDto {
  @ApiProperty({
    description: "Refresh JWT issued by the matching auth surface.",
    required: false,
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  })
  @IsOptional()
  @IsJWT()
  refreshToken?: string;
}

export class OptionalLogoutDto extends OptionalRefreshTokenDto {}
