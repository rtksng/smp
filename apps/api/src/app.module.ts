import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ApiResponseInterceptor } from "./common/interceptors/api-response.interceptor";
import { StructuredLogger } from "./common/logging/structured-logger.service";
import { RequestLoggingMiddleware } from "./common/middleware/request-logging.middleware";
import { ErrorMonitoringService } from "./common/monitoring/error-monitoring.service";
import { createRedisThrottlerStorage } from "./common/rate-limit/redis-throttler-storage";
import { loadApiEnvironment } from "./config/api.config";
import { PrismaModule } from "./database/prisma.module";
import { AdminUsersModule } from "./modules/admin-users/admin-users.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BrandsModule } from "./modules/brands/brands.module";
import { CartModule } from "./modules/cart/cart.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { CouponsModule } from "./modules/coupons/coupons.module";
import { DeliveryModule } from "./modules/delivery/delivery.module";
import { DeliveryChargesModule } from "./modules/delivery-charges/delivery-charges.module";
import { HealthModule } from "./modules/health/health.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { PermissionsModule } from "./modules/permissions/permissions.module";
import { ProductsModule } from "./modules/products/products.module";
import { ProductFeedbackModule } from "./modules/product-feedback/product-feedback.module";
import { QuoteRequestsModule } from "./modules/quote-requests/quote-requests.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { RolesModule } from "./modules/roles/roles.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
import { WarehousesModule } from "./modules/warehouses/warehouses.module";
import { WishlistModule } from "./modules/wishlist/wishlist.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: [".env", "../../.env"],
      isGlobal: true,
      load: [loadApiEnvironment]
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        errorMessage: "Too many requests. Please retry later.",
        storage: createRedisThrottlerStorage(configService),
        throttlers: [
          {
            blockDuration: configService.get<number>("throttleBlockMs", 60000),
            limit: configService.get<number>("throttleLimit", 100),
            ttl: configService.get<number>("throttleTtlMs", 60000)
          }
        ]
      })
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    AdminUsersModule,
    CustomersModule,
    CouponsModule,
    DeliveryChargesModule,
    DeliveryModule,
    CartModule,
    CategoriesModule,
    BrandsModule,
    ProductsModule,
    ProductFeedbackModule,
    QuoteRequestsModule,
    OrdersModule,
    PaymentsModule,
    InventoryModule,
    PermissionsModule,
    ReportsModule,
    RolesModule,
    UploadsModule,
    WarehousesModule,
    WishlistModule
  ],
  providers: [
    StructuredLogger,
    ErrorMonitoringService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiResponseInterceptor
    }
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes("*");
  }
}
