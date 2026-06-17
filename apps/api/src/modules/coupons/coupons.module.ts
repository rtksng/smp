import { Module } from "@nestjs/common";
import { AuthCommonModule } from "../auth/common/auth-common.module";
import {
  AdminCouponsController,
  CouponsController
} from "./coupons.controller";
import { CouponsService } from "./coupons.service";

@Module({
  controllers: [CouponsController, AdminCouponsController],
  exports: [CouponsService],
  imports: [AuthCommonModule],
  providers: [CouponsService]
})
export class CouponsModule {}
