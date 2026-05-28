import { Module } from "@nestjs/common";
import { AdminAuthModule } from "./admin/admin-auth.module";
import { AuthCommonModule } from "./common/auth-common.module";
import { CustomerAuthModule } from "./customer/customer-auth.module";
import { DeliveryPartnerAuthModule } from "./delivery-partner/delivery-partner-auth.module";

@Module({
  exports: [AuthCommonModule],
  imports: [
    AuthCommonModule,
    CustomerAuthModule,
    AdminAuthModule,
    DeliveryPartnerAuthModule
  ]
})
export class AuthModule {}
