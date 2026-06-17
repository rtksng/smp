import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { MODULE_METADATA } from "@nestjs/common/constants";
import { AuthModule } from "../../src/modules/auth/auth.module";
import { AuthCommonModule } from "../../src/modules/auth/common/auth-common.module";
import { BrandsModule } from "../../src/modules/brands/brands.module";
import { CartModule } from "../../src/modules/cart/cart.module";
import { CategoriesModule } from "../../src/modules/categories/categories.module";
import { CouponsModule } from "../../src/modules/coupons/coupons.module";
import { CustomersModule } from "../../src/modules/customers/customers.module";
import { DeliveryModule } from "../../src/modules/delivery/delivery.module";
import { InventoryModule } from "../../src/modules/inventory/inventory.module";
import { OrdersModule } from "../../src/modules/orders/orders.module";
import { PaymentsModule } from "../../src/modules/payments/payments.module";
import { PermissionsModule } from "../../src/modules/permissions/permissions.module";
import { ProductFeedbackModule } from "../../src/modules/product-feedback/product-feedback.module";
import { ProductsModule } from "../../src/modules/products/products.module";
import { QuoteRequestsModule } from "../../src/modules/quote-requests/quote-requests.module";
import { ReportsModule } from "../../src/modules/reports/reports.module";
import { RolesModule } from "../../src/modules/roles/roles.module";
import { UploadsModule } from "../../src/modules/uploads/uploads.module";
import { WarehousesModule } from "../../src/modules/warehouses/warehouses.module";
import { WishlistModule } from "../../src/modules/wishlist/wishlist.module";

const guardedModules = [
  BrandsModule,
  CartModule,
  CategoriesModule,
  CouponsModule,
  CustomersModule,
  DeliveryModule,
  InventoryModule,
  OrdersModule,
  PaymentsModule,
  PermissionsModule,
  ProductFeedbackModule,
  ProductsModule,
  QuoteRequestsModule,
  ReportsModule,
  RolesModule,
  UploadsModule,
  WarehousesModule,
  WishlistModule
];

test("modules with class-based auth guards import auth providers", () => {
  for (const moduleClass of guardedModules) {
    const imports =
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleClass) ?? [];

    assert.ok(
      imports.includes(AuthCommonModule) || imports.includes(AuthModule),
      `${moduleClass.name} must import AuthCommonModule or AuthModule`
    );
  }
});
