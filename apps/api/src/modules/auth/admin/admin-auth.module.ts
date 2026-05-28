import { Module } from "@nestjs/common";
import { AuthCommonModule } from "../common/auth-common.module";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminAuthService } from "./admin-auth.service";

@Module({
  controllers: [AdminAuthController],
  imports: [AuthCommonModule],
  providers: [AdminAuthService]
})
export class AdminAuthModule {}
