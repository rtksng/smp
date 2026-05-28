import { Module } from "@nestjs/common";
import { AuthCommonModule } from "../auth/common/auth-common.module";
import { PermissionsController } from "./permissions.controller";
import { PermissionsService } from "./permissions.service";

@Module({
  controllers: [PermissionsController],
  exports: [PermissionsService],
  imports: [AuthCommonModule],
  providers: [PermissionsService]
})
export class PermissionsModule {}
