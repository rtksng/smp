import { Module } from "@nestjs/common";
import { AuthCommonModule } from "../auth/common/auth-common.module";
import { ProductsModule } from "../products/products.module";
import { WishlistController } from "./wishlist.controller";
import { WishlistService } from "./wishlist.service";

@Module({
  controllers: [WishlistController],
  imports: [AuthCommonModule, ProductsModule],
  providers: [WishlistService]
})
export class WishlistModule {}
