import { Module } from "@nestjs/common";
import { AuthCommonModule } from "../auth/common/auth-common.module";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";

@Module({
  controllers: [AdminUsersController],
  exports: [AdminUsersService],
  imports: [AuthCommonModule],
  providers: [AdminUsersService]
})
export class AdminUsersModule {}
