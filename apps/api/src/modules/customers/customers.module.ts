import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminCustomersController } from "./admin-customers.controller";
import { AdminCustomersService } from "./admin-customers.service";
import { CustomerProfileController } from "./customer-profile.controller";
import { CustomerProfileService } from "./customer-profile.service";

@Module({
  controllers: [CustomerProfileController, AdminCustomersController],
  exports: [CustomerProfileService, AdminCustomersService],
  imports: [AuthModule],
  providers: [CustomerProfileService, AdminCustomersService]
})
export class CustomersModule {}
