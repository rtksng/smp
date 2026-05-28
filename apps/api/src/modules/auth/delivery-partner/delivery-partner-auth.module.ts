import { Module } from "@nestjs/common";
import { AuthCommonModule } from "../common/auth-common.module";
import { DeliveryPartnerAuthController } from "./delivery-partner-auth.controller";
import { DeliveryPartnerAuthService } from "./delivery-partner-auth.service";

@Module({
  controllers: [DeliveryPartnerAuthController],
  imports: [AuthCommonModule],
  providers: [DeliveryPartnerAuthService]
})
export class DeliveryPartnerAuthModule {}
