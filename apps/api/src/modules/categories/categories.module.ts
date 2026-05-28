import { Module } from "@nestjs/common";
import { AuthCommonModule } from "../auth/common/auth-common.module";
import { AdminCategoriesController } from "./admin-categories.controller";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";

@Module({
  controllers: [CategoriesController, AdminCategoriesController],
  exports: [CategoriesService],
  imports: [AuthCommonModule],
  providers: [CategoriesService]
})
export class CategoriesModule {}
