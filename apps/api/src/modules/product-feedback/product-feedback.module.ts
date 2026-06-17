import { Module } from "@nestjs/common";
import { AuthCommonModule } from "../auth/common/auth-common.module";
import {
  AdminProductFeedbackController,
  ProductFeedbackController
} from "./product-feedback.controller";
import { ProductFeedbackService } from "./product-feedback.service";

@Module({
  controllers: [ProductFeedbackController, AdminProductFeedbackController],
  imports: [AuthCommonModule],
  providers: [ProductFeedbackService]
})
export class ProductFeedbackModule {}
