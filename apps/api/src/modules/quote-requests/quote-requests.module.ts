import { Module } from "@nestjs/common";
import { AuthCommonModule } from "../auth/common/auth-common.module";
import { CartModule } from "../cart/cart.module";
import { OrdersModule } from "../orders/orders.module";
import {
  AdminQuoteRequestsController,
  QuoteRequestsController
} from "./quote-requests.controller";
import { QuoteRequestsService } from "./quote-requests.service";

@Module({
  controllers: [QuoteRequestsController, AdminQuoteRequestsController],
  imports: [AuthCommonModule, CartModule, OrdersModule],
  providers: [QuoteRequestsService]
})
export class QuoteRequestsModule {}
