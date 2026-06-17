import { Module } from "@nestjs/common";
import { AuthCommonModule } from "../auth/common/auth-common.module";
import { DeliveryChargesModule } from "../delivery-charges/delivery-charges.module";
import { CartController } from "./cart.controller";
import { CartService } from "./cart.service";

@Module({
  controllers: [CartController],
  exports: [CartService],
  imports: [AuthCommonModule, DeliveryChargesModule],
  providers: [CartService]
})
export class CartModule {}
