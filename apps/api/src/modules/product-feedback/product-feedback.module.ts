import { Module } from "@nestjs/common";
import { ApiQueuesModule } from "../../queues/api-queues.module";
import { AuthCommonModule } from "../auth/common/auth-common.module";
import {
  AdminProductFeedbackController,
  ProductFeedbackController
} from "./product-feedback.controller";
import { ProductFeedbackService } from "./product-feedback.service";

@Module({
  controllers: [ProductFeedbackController, AdminProductFeedbackController],
  imports: [AuthCommonModule, ApiQueuesModule],
  providers: [ProductFeedbackService]
})
export class ProductFeedbackModule {}
