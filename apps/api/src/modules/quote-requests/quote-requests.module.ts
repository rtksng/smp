import { Module } from "@nestjs/common";
import { AuthCommonModule } from "../auth/common/auth-common.module";
import {
  AdminQuoteRequestsController,
  QuoteRequestsController
} from "./quote-requests.controller";
import { QuoteRequestsService } from "./quote-requests.service";

@Module({
  controllers: [QuoteRequestsController, AdminQuoteRequestsController],
  imports: [AuthCommonModule],
  providers: [QuoteRequestsService]
})
export class QuoteRequestsModule {}
