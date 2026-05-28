import { Module } from "@nestjs/common";
import { AuthCommonModule } from "../auth/common/auth-common.module";
import { AdminProductsController } from "./admin-products.controller";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  controllers: [ProductsController, AdminProductsController],
  exports: [ProductsService],
  imports: [AuthCommonModule],
  providers: [ProductsService]
})
export class ProductsModule {}
