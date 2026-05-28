-- Delivery partner operational fields
ALTER TABLE "DeliveryPartner"
  ADD COLUMN "isOnline" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lastSeenAt" TIMESTAMP(3),
  ADD COLUMN "walletBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "totalEarnings" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Delivery assignment pickup and proof placeholders
ALTER TABLE "DeliveryAssignment"
  ADD COLUMN "pickupWarehouseId" TEXT,
  ADD COLUMN "proofOfDeliveryUrl" TEXT,
  ADD COLUMN "proofOfDeliveryKey" TEXT,
  ADD COLUMN "failureReason" TEXT;

CREATE INDEX "DeliveryAssignment_pickupWarehouseId_idx" ON "DeliveryAssignment"("pickupWarehouseId");

ALTER TABLE "DeliveryAssignment"
  ADD CONSTRAINT "DeliveryAssignment_pickupWarehouseId_fkey"
  FOREIGN KEY ("pickupWarehouseId") REFERENCES "Warehouse"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
