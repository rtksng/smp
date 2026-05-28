import { Module } from "@nestjs/common";
import { AuthCommonModule } from "../auth/common/auth-common.module";
import { AdminBrandsController } from "./admin-brands.controller";
import { BrandsController } from "./brands.controller";
import { BrandsService } from "./brands.service";

@Module({
  controllers: [BrandsController, AdminBrandsController],
  exports: [BrandsService],
  imports: [AuthCommonModule],
  providers: [BrandsService]
})
export class BrandsModule {}
