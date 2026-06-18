import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { ApiQueuesModule } from "../../queues/api-queues.module";
import { AuthCommonModule } from "../auth/common/auth-common.module";
import { CartModule } from "../cart/cart.module";
import { DeliveryChargesModule } from "../delivery-charges/delivery-charges.module";
import { InvoicesModule } from "../invoices/invoices.module";
import { PaymentsModule } from "../payments/payments.module";
import { WarehousesModule } from "../warehouses/warehouses.module";
import {
  AdminOrdersController,
  AdminReturnsRefundsController
} from "./admin-orders.controller";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  controllers: [OrdersController, AdminOrdersController, AdminReturnsRefundsController],
  imports: [
    AuthCommonModule,
    CartModule,
    DeliveryChargesModule,
    PrismaModule,
    WarehousesModule,
    InvoicesModule,
    PaymentsModule,
    ApiQueuesModule
  ],
  exports: [OrdersService],
  providers: [OrdersService]
})
export class OrdersModule {}
