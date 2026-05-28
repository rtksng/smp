import { Module } from "@nestjs/common";
import { AuthCommonModule } from "../auth/common/auth-common.module";
import { WarehousesModule } from "../warehouses/warehouses.module";
import { AdminDeliveryController } from "./admin-delivery.controller";
import { AdminDeliveryPartnersController } from "./admin-delivery-partners.controller";
import { DeliveryController } from "./delivery.controller";
import { DeliveryService } from "./delivery.service";

@Module({
  controllers: [
    AdminDeliveryController,
    AdminDeliveryPartnersController,
    DeliveryController
  ],
  exports: [DeliveryService],
  imports: [AuthCommonModule, WarehousesModule],
  providers: [DeliveryService]
})
export class DeliveryModule {}
