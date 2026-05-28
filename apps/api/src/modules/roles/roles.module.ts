import { Module } from "@nestjs/common";
import { AuthCommonModule } from "../auth/common/auth-common.module";
import { RolesController } from "./roles.controller";
import { RolesService } from "./roles.service";

@Module({
  controllers: [RolesController],
  exports: [RolesService],
  imports: [AuthCommonModule],
  providers: [RolesService]
})
export class RolesModule {}
