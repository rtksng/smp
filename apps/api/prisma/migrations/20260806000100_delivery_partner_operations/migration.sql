-- Delivery partner application status and field incident support
CREATE TYPE "DeliveryIncidentType" AS ENUM (
  'CUSTOMER_UNREACHABLE',
  'INCORRECT_ADDRESS',
  'PACKAGE_DAMAGED',
  'PACKAGE_MISSING',
  'VEHICLE_BREAKDOWN',
  'PAYMENT_DISPUTE',
  'OTHER'
);

CREATE TYPE "DeliveryIncidentStatus" AS ENUM ('OPEN', 'RESOLVED');
CREATE TYPE "DeliveryLedgerEntryType" AS ENUM ('DELIVERY_EARNING', 'PAYOUT');

ALTER TABLE "DeliveryPartner"
  ADD COLUMN "statusReason" TEXT;

CREATE TABLE "DeliveryIncident" (
  "id" TEXT NOT NULL,
  "deliveryAssignmentId" TEXT NOT NULL,
  "deliveryPartnerId" TEXT NOT NULL,
  "type" "DeliveryIncidentType" NOT NULL,
  "status" "DeliveryIncidentStatus" NOT NULL DEFAULT 'OPEN',
  "note" TEXT,
  "photoUrl" TEXT,
  "photoKey" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeliveryIncident_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeliveryIncident_deliveryAssignmentId_idx"
  ON "DeliveryIncident"("deliveryAssignmentId");
CREATE INDEX "DeliveryIncident_deliveryPartnerId_status_createdAt_idx"
  ON "DeliveryIncident"("deliveryPartnerId", "status", "createdAt");
CREATE INDEX "DeliveryIncident_type_idx" ON "DeliveryIncident"("type");

ALTER TABLE "DeliveryIncident"
  ADD CONSTRAINT "DeliveryIncident_deliveryAssignmentId_fkey"
  FOREIGN KEY ("deliveryAssignmentId") REFERENCES "DeliveryAssignment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DeliveryPartnerLedgerEntry" (
  "id" TEXT NOT NULL,
  "deliveryPartnerId" TEXT NOT NULL,
  "type" "DeliveryLedgerEntryType" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "description" TEXT NOT NULL,
  "reference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeliveryPartnerLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeliveryPartnerLedgerEntry_deliveryPartnerId_createdAt_idx"
  ON "DeliveryPartnerLedgerEntry"("deliveryPartnerId", "createdAt");
CREATE INDEX "DeliveryPartnerLedgerEntry_type_idx"
  ON "DeliveryPartnerLedgerEntry"("type");

ALTER TABLE "DeliveryPartnerLedgerEntry"
  ADD CONSTRAINT "DeliveryPartnerLedgerEntry_deliveryPartnerId_fkey"
  FOREIGN KEY ("deliveryPartnerId") REFERENCES "DeliveryPartner"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeliveryIncident"
  ADD CONSTRAINT "DeliveryIncident_deliveryPartnerId_fkey"
  FOREIGN KEY ("deliveryPartnerId") REFERENCES "DeliveryPartner"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
