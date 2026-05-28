import { Module } from "@nestjs/common";
import { ApiQueuesModule } from "../../queues/api-queues.module";
import { AuthCommonModule } from "../auth/common/auth-common.module";
import { WarehousesModule } from "../warehouses/warehouses.module";
import { AdminInventoryController } from "./admin-inventory.controller";
import { InventoryService } from "./inventory.service";

@Module({
  controllers: [AdminInventoryController],
  exports: [InventoryService],
  imports: [AuthCommonModule, WarehousesModule, ApiQueuesModule],
  providers: [InventoryService]
})
export class InventoryModule {}
