import { Module } from "@nestjs/common";
import { AuthCommonModule } from "../auth/common/auth-common.module";
import { CartController } from "./cart.controller";
import { CartService } from "./cart.service";

@Module({
  controllers: [CartController],
  exports: [CartService],
  imports: [AuthCommonModule],
  providers: [CartService]
})
export class CartModule {}
