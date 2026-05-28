import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsString, MinLength } from "class-validator";

export class AdminLoginDto {
  @ApiProperty({
    description: "Admin email address.",
    example: "admin@surgical.local"
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value
  )
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: "Admin password.",
    example: "ChangeMe123!"
  })
  @IsString()
  @MinLength(8)
  password!: string;
}
