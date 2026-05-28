import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ApiQueuesModule } from "../../../queues/api-queues.module";
import { AdminPermissionsGuard } from "../guards/admin-permissions.guard";
import { AdminJwtGuard } from "../guards/admin-jwt.guard";
import { CustomerJwtGuard } from "../guards/customer-jwt.guard";
import { DeliveryPartnerJwtGuard } from "../guards/delivery-partner-jwt.guard";
import { PermissionGuard } from "../guards/permission.guard";
import { AuthTokenService } from "./auth-token.service";
import { OtpService } from "./otp.service";
import { PasswordService } from "./password.service";
import { RedisCacheService } from "./redis-cache.service";

@Module({
  exports: [
    AdminJwtGuard,
    AdminPermissionsGuard,
    AuthTokenService,
    CustomerJwtGuard,
    DeliveryPartnerJwtGuard,
    OtpService,
    PasswordService,
    PermissionGuard
  ],
  imports: [JwtModule.register({}), ApiQueuesModule],
  providers: [
    AdminJwtGuard,
    AdminPermissionsGuard,
    AuthTokenService,
    CustomerJwtGuard,
    DeliveryPartnerJwtGuard,
    OtpService,
    PasswordService,
    PermissionGuard,
    RedisCacheService
  ]
})
export class AuthCommonModule {}
