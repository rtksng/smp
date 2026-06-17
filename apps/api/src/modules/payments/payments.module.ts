import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { ApiQueuesModule } from "../../queues/api-queues.module";
import { AuthCommonModule } from "../auth/common/auth-common.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { RazorpayClient } from "./razorpay.client";

@Module({
  controllers: [PaymentsController],
  imports: [AuthCommonModule, PrismaModule, ApiQueuesModule],
  providers: [PaymentsService, RazorpayClient],
  exports: [PaymentsService]
})
export class PaymentsModule {}
