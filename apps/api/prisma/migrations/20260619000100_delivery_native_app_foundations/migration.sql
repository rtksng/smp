-- Native delivery app device, location, proof, and COD foundations
CREATE TYPE "CashCollectionStatus" AS ENUM ('NOT_REQUIRED', 'COLLECTED', 'SUBMITTED', 'SETTLED');

ALTER TABLE "DeliveryPartner"
  ADD COLUMN "lastLatitude" DECIMAL(10,7),
  ADD COLUMN "lastLongitude" DECIMAL(10,7),
  ADD COLUMN "lastLocationAt" TIMESTAMP(3);

CREATE TABLE "DeliveryPartnerDevice" (
  "id" TEXT NOT NULL,
  "deliveryPartnerId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "pushToken" TEXT NOT NULL,
  "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeliveryPartnerDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeliveryPartnerDevice_pushToken_key" ON "DeliveryPartnerDevice"("pushToken");
CREATE INDEX "DeliveryPartnerDevice_deliveryPartnerId_idx" ON "DeliveryPartnerDevice"("deliveryPartnerId");
CREATE INDEX "DeliveryPartnerDevice_platform_idx" ON "DeliveryPartnerDevice"("platform");
CREATE INDEX "DeliveryPartnerDevice_revokedAt_idx" ON "DeliveryPartnerDevice"("revokedAt");

ALTER TABLE "DeliveryPartnerDevice"
  ADD CONSTRAINT "DeliveryPartnerDevice_deliveryPartnerId_fkey"
  FOREIGN KEY ("deliveryPartnerId") REFERENCES "DeliveryPartner"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeliveryAssignment"
  ADD COLUMN "receiverName" TEXT,
  ADD COLUMN "cashCollectedAmount" DECIMAL(12,2),
  ADD COLUMN "cashCollectedAt" TIMESTAMP(3),
  ADD COLUMN "cashSettlementStatus" "CashCollectionStatus" NOT NULL DEFAULT 'NOT_REQUIRED';
