import { Module } from "@nestjs/common";
import { AuthCommonModule } from "../auth/common/auth-common.module";
import { AdminDeliveryChargesController } from "./delivery-charges.controller";
import { DeliveryChargesService } from "./delivery-charges.service";

@Module({
  controllers: [AdminDeliveryChargesController],
  exports: [DeliveryChargesService],
  imports: [AuthCommonModule],
  providers: [DeliveryChargesService]
})
export class DeliveryChargesModule {}
