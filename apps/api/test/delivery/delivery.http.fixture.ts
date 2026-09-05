import "reflect-metadata";
import { type ExecutionContext, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import { createValidationPipe } from "../../src/config/validation.config";
import { ApiResponseInterceptor } from "../../src/common/interceptors/api-response.interceptor";
import { PrismaService } from "../../src/database/prisma.service";
import { AuthTokenAudience } from "../../src/modules/auth/common/auth-token.service";
import { AdminJwtGuard } from "../../src/modules/auth/guards/admin-jwt.guard";
import { CustomerJwtGuard } from "../../src/modules/auth/guards/customer-jwt.guard";
import { DeliveryPartnerJwtGuard } from "../../src/modules/auth/guards/delivery-partner-jwt.guard";
import { PermissionGuard } from "../../src/modules/auth/guards/permission.guard";
import { AdminDeliveryController } from "../../src/modules/delivery/admin-delivery.controller";
import { AdminDeliveryPartnersController } from "../../src/modules/delivery/admin-delivery-partners.controller";
import { DeliveryController } from "../../src/modules/delivery/delivery.controller";
import { DeliveryService } from "../../src/modules/delivery/delivery.service";
import { AdminDeliveryAssignmentListQueryDto, AssignDeliveryDto, CreateDeliveryIncidentDto, DeliveryAssignmentListQueryDto, UpdateCashSettlementDto, UpdateDeliveryAssignmentStatusDto } from "../../src/modules/delivery/dto/delivery.dto";
import { InvoicesService } from "../../src/modules/invoices/invoices.service";
import { OrdersController } from "../../src/modules/orders/orders.controller";
import { OrdersService } from "../../src/modules/orders/orders.service";
import { WarehouseAccessService } from "../../src/modules/warehouses/warehouse-access.service";
import type { ApiQueueService } from "../../src/queues/api-queue.service";
import { adminAuth, createDeliveryPrismaMock, FakeWarehouseAccess } from "./delivery.fixture";

export const deliveryHttpIds = {
  order: "00000000-0000-4000-8000-000000000001",
  partner: "00000000-0000-4000-8000-000000000002",
  assignment: "00000000-0000-4000-8000-000000000003",
  warehouse: "00000000-0000-4000-8000-000000000004",
  customer: "00000000-0000-4000-8000-000000000005"
};

/** Real controllers, validation and domain services with isolated persistence and synthetic principals. */
export async function createDeliveryHttpFixture(configureApp?: (app: INestApplication) => void) {
  const prisma = createDeliveryPrismaMock({ useHttpIds: true, orderStatus: "PACKED" });
  const access = new FakeWarehouseAccess() as unknown as WarehouseAccessService;
  const service = new DeliveryService(prisma as unknown as PrismaService, access, { enqueueDeliveryAssignmentNotification: async () => undefined } as unknown as ApiQueueService);
  const orders = new OrdersService(prisma as unknown as PrismaService, access);
  for (const controller of [AdminDeliveryController, AdminDeliveryPartnersController, DeliveryController]) {
    Reflect.defineMetadata("design:paramtypes", [DeliveryService], controller);
  }
  Reflect.defineMetadata("design:paramtypes", [OrdersService, InvoicesService], OrdersController);
  // tsx omits decorator type metadata emitted by the production TypeScript compiler.
  for (const [controller, method, types] of [
    [AdminDeliveryController, "assignOrder", [AssignDeliveryDto, Object]],
    [AdminDeliveryController, "listAssignments", [AdminDeliveryAssignmentListQueryDto]],
    [AdminDeliveryController, "updateCashSettlement", [String, UpdateCashSettlementDto, Object]],
    [DeliveryController, "listAssignments", [DeliveryAssignmentListQueryDto, Object]],
    [DeliveryController, "updateAssignmentStatus", [String, UpdateDeliveryAssignmentStatusDto, Object]],
    [DeliveryController, "createIncident", [String, CreateDeliveryIncidentDto, Object]]
  ] as const) Reflect.defineMetadata("design:paramtypes", types, controller.prototype, method);
  const principal = (audience: AuthTokenAudience, sub: string) => ({
    canActivate(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest();
      req.auth = { ...adminAuth(), audience, sub: req.headers["x-test-principal"] ?? sub };
      return true;
    }
  });
  const module = await Test.createTestingModule({
    controllers: [AdminDeliveryController, AdminDeliveryPartnersController, DeliveryController, OrdersController],
    providers: [
      { provide: DeliveryService, useValue: service },
      { provide: OrdersService, useValue: orders },
      { provide: InvoicesService, useValue: {} }
    ]
  })
    .overrideGuard(AdminJwtGuard).useValue(principal(AuthTokenAudience.Admin, "qa-admin"))
    .overrideGuard(DeliveryPartnerJwtGuard).useValue(principal(AuthTokenAudience.DeliveryPartner, deliveryHttpIds.partner))
    .overrideGuard(CustomerJwtGuard).useValue(principal(AuthTokenAudience.Customer, deliveryHttpIds.customer))
    .overrideGuard(PermissionGuard).useValue(new PermissionGuard(new Reflector()))
    .compile();
  const app = module.createNestApplication();
  app.useLogger(false);
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  configureApp?.(app);
  await app.init();
  return { app, prisma, service, orders };
}
