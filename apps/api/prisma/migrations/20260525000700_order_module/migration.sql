ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";

CREATE TYPE "OrderStatus" AS ENUM (
  'CREATED',
  'CONFIRMED',
  'PACKED',
  'ASSIGNED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'RETURNED'
);

ALTER TABLE "Order"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Order"
  ALTER COLUMN "status" TYPE "OrderStatus"
  USING (
    CASE "status"::text
      WHEN 'PENDING' THEN 'CREATED'
      WHEN 'PROCESSING' THEN 'PACKED'
      WHEN 'READY_TO_DISPATCH' THEN 'PACKED'
      WHEN 'REFUNDED' THEN 'RETURNED'
      ELSE "status"::text
    END
  )::"OrderStatus";

ALTER TABLE "OrderStatusHistory"
  ALTER COLUMN "status" TYPE "OrderStatus"
  USING (
    CASE "status"::text
      WHEN 'PENDING' THEN 'CREATED'
      WHEN 'PROCESSING' THEN 'PACKED'
      WHEN 'READY_TO_DISPATCH' THEN 'PACKED'
      WHEN 'REFUNDED' THEN 'RETURNED'
      ELSE "status"::text
    END
  )::"OrderStatus";

ALTER TABLE "Order"
  ALTER COLUMN "status" SET DEFAULT 'CREATED';

DROP TYPE "OrderStatus_old";

ALTER TABLE "Order"
  ADD COLUMN "warehouseId" TEXT;

ALTER TABLE "OrderItem"
  ADD COLUMN "warehouseId" TEXT,
  ADD COLUMN "stockBatchId" TEXT;

CREATE INDEX "Order_warehouseId_idx" ON "Order"("warehouseId");
CREATE INDEX "OrderItem_warehouseId_idx" ON "OrderItem"("warehouseId");
CREATE INDEX "OrderItem_stockBatchId_idx" ON "OrderItem"("stockBatchId");

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_stockBatchId_fkey"
  FOREIGN KEY ("stockBatchId") REFERENCES "StockBatch"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
