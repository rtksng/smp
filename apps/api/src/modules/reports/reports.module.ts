import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AuthCommonModule } from "../auth/common/auth-common.module";
import { WarehousesModule } from "../warehouses/warehouses.module";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { WarehouseDashboardService } from "./warehouse-dashboard.service";

@Module({
  controllers: [ReportsController],
  imports: [AuthCommonModule, PrismaModule, WarehousesModule],
  providers: [ReportsService, WarehouseDashboardService]
})
export class ReportsModule {}
