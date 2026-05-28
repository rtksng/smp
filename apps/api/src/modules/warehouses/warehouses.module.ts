import { Module } from "@nestjs/common";
import { AuthCommonModule } from "../auth/common/auth-common.module";
import { AdminWarehousesController } from "./admin-warehouses.controller";
import { WarehouseAccessService } from "./warehouse-access.service";
import { WarehousesService } from "./warehouses.service";

@Module({
  controllers: [AdminWarehousesController],
  exports: [WarehouseAccessService, WarehousesService],
  imports: [AuthCommonModule],
  providers: [WarehouseAccessService, WarehousesService]
})
export class WarehousesModule {}
