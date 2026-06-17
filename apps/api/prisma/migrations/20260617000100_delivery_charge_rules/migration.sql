-- CreateTable
CREATE TABLE "DeliveryChargeRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "charge" DECIMAL(12,2) NOT NULL,
    "minOrderAmount" DECIMAL(12,2),
    "maxOrderAmount" DECIMAL(12,2),
    "freeDeliveryThreshold" DECIMAL(12,2),
    "pincode" TEXT,
    "warehouseId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DeliveryChargeRule_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "GSTInvoice"
ADD COLUMN "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "shippingTotal" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "DeliveryChargeRule_isActive_idx" ON "DeliveryChargeRule"("isActive");

-- CreateIndex
CREATE INDEX "DeliveryChargeRule_pincode_idx" ON "DeliveryChargeRule"("pincode");

-- CreateIndex
CREATE INDEX "DeliveryChargeRule_warehouseId_idx" ON "DeliveryChargeRule"("warehouseId");

-- CreateIndex
CREATE INDEX "DeliveryChargeRule_priority_idx" ON "DeliveryChargeRule"("priority");

-- CreateIndex
CREATE INDEX "DeliveryChargeRule_deletedAt_idx" ON "DeliveryChargeRule"("deletedAt");

-- CreateIndex
CREATE INDEX "DeliveryChargeRule_minOrderAmount_maxOrderAmount_idx" ON "DeliveryChargeRule"("minOrderAmount", "maxOrderAmount");

-- AddForeignKey
ALTER TABLE "DeliveryChargeRule" ADD CONSTRAINT "DeliveryChargeRule_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
