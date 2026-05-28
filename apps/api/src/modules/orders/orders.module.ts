import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { ApiQueuesModule } from "../../queues/api-queues.module";
import { AuthCommonModule } from "../auth/common/auth-common.module";
import { InvoicesModule } from "../invoices/invoices.module";
import { WarehousesModule } from "../warehouses/warehouses.module";
import { AdminOrdersController } from "./admin-orders.controller";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  controllers: [OrdersController, AdminOrdersController],
  imports: [
    AuthCommonModule,
    PrismaModule,
    WarehousesModule,
    InvoicesModule,
    ApiQueuesModule
  ],
  providers: [OrdersService]
})
export class OrdersModule {}
