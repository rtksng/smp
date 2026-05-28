import { Module } from "@nestjs/common";
import { AuthCommonModule } from "../common/auth-common.module";
import { CustomerAuthController } from "./customer-auth.controller";
import { CustomerAuthService } from "./customer-auth.service";

@Module({
  controllers: [CustomerAuthController],
  imports: [AuthCommonModule],
  providers: [CustomerAuthService]
})
export class CustomerAuthModule {}
