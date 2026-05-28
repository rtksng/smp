import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { WarehousesModule } from "../warehouses/warehouses.module";
import { InvoicesService } from "./invoices.service";

@Module({
  exports: [InvoicesService],
  imports: [PrismaModule, WarehousesModule],
  providers: [InvoicesService]
})
export class InvoicesModule {}
