import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, Matches } from "class-validator";

export class DeliveryPartnerRequestOtpDto {
  @ApiProperty({
    description:
      "Delivery partner mobile number in E.164 format. These APIs are for the future delivery mobile app.",
    example: "+919876543210"
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value
  )
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  mobileNumber!: string;
}

export class DeliveryPartnerVerifyOtpDto extends DeliveryPartnerRequestOtpDto {
  @ApiProperty({
    description: "Six digit OTP sent through the mocked OTP provider.",
    example: "123456"
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value
  )
  @IsString()
  @Matches(/^\d{6}$/)
  otp!: string;
}
