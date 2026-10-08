-- Delivery partner warehouse coverage, pay structure, and automatic earnings
CREATE TYPE "DeliveryPartnerPaymentType" AS ENUM ('SALARY', 'COMMISSION');
CREATE TYPE "DeliveryCommissionType" AS ENUM ('PERCENTAGE', 'FIXED');
ALTER TYPE "DeliveryLedgerEntryType" ADD VALUE 'SALARY';

ALTER TABLE "DeliveryPartner"
  ADD COLUMN "paymentType" "DeliveryPartnerPaymentType",
  ADD COLUMN "commissionType" "DeliveryCommissionType",
  ADD COLUMN "commissionValue" DECIMAL(12,2),
  ADD COLUMN "monthlySalary" DECIMAL(12,2);

ALTER TABLE "DeliveryPartnerLedgerEntry"
  ADD COLUMN "deliveryAssignmentId" TEXT,
  ADD COLUMN "salaryPeriod" TEXT;

CREATE UNIQUE INDEX "DeliveryPartnerLedgerEntry_deliveryAssignmentId_key"
  ON "DeliveryPartnerLedgerEntry"("deliveryAssignmentId");
CREATE UNIQUE INDEX "DeliveryPartnerLedgerEntry_deliveryPartnerId_salaryPeriod_key"
  ON "DeliveryPartnerLedgerEntry"("deliveryPartnerId", "salaryPeriod");

ALTER TABLE "DeliveryPartnerLedgerEntry"
  ADD CONSTRAINT "DeliveryPartnerLedgerEntry_deliveryAssignmentId_fkey"
  FOREIGN KEY ("deliveryAssignmentId") REFERENCES "DeliveryAssignment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DeliveryPartnerWarehouse" (
  "id" TEXT NOT NULL,
  "deliveryPartnerId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeliveryPartnerWarehouse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeliveryPartnerWarehouse_deliveryPartnerId_warehouseId_key"
  ON "DeliveryPartnerWarehouse"("deliveryPartnerId", "warehouseId");
CREATE INDEX "DeliveryPartnerWarehouse_warehouseId_idx"
  ON "DeliveryPartnerWarehouse"("warehouseId");

ALTER TABLE "DeliveryPartnerWarehouse"
  ADD CONSTRAINT "DeliveryPartnerWarehouse_deliveryPartnerId_fkey"
  FOREIGN KEY ("deliveryPartnerId") REFERENCES "DeliveryPartner"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryPartnerWarehouse"
  ADD CONSTRAINT "DeliveryPartnerWarehouse_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Link existing partners to every warehouse they have already delivered for,
-- so warehouse staff keep seeing them and dispatch keeps working.
INSERT INTO "DeliveryPartnerWarehouse" ("id", "deliveryPartnerId", "warehouseId", "createdAt", "updatedAt")
SELECT
  'dpw-' || md5(links."deliveryPartnerId" || ':' || links."warehouseId"),
  links."deliveryPartnerId",
  links."warehouseId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT
    a."deliveryPartnerId",
    COALESCE(a."pickupWarehouseId", o."warehouseId") AS "warehouseId"
  FROM "DeliveryAssignment" a
  JOIN "Order" o ON o."id" = a."orderId"
) links
JOIN "Warehouse" w
  ON w."id" = links."warehouseId" AND w."deletedAt" IS NULL
ON CONFLICT ("deliveryPartnerId", "warehouseId") DO NOTHING;

-- SeedPermissions
INSERT INTO "Permission" ("id", "name", "code", "description", "createdAt", "updatedAt")
VALUES
  (
    'permission-delivery-partners-manage',
    'Manage delivery partners',
    'delivery.partners.manage',
    'Create and update delivery partner profiles for accessible warehouses.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'permission-delivery-payouts-manage',
    'Manage delivery partner pay',
    'delivery.payouts.manage',
    'Configure delivery partner salary or commission and record payouts.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("code") DO UPDATE SET
  "deletedAt" = NULL,
  "description" = EXCLUDED."description",
  "name" = EXCLUDED."name",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Payout posting moves from delivery.assign to delivery.payouts.manage. Roles
-- that hold delivery.assign today keep it. This runs before warehouse managers
-- receive delivery.assign below, so they do not gain pay settings.
WITH permission AS (
  SELECT "id" FROM "Permission" WHERE "code" = 'delivery.payouts.manage'
),
roles AS (
  SELECT DISTINCT r."id", r."code"
  FROM "Role" r
  LEFT JOIN "RolePermission" rp ON rp."roleId" = r."id"
  LEFT JOIN "Permission" p
    ON p."id" = rp."permissionId"
    AND p."code" = 'delivery.assign'
  WHERE r."deletedAt" IS NULL
    AND (
      r."code" IN ('SUPER_ADMIN', 'DELIVERY_MANAGER')
      OR p."id" IS NOT NULL
    )
)
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt", "updatedAt")
SELECT
  'role-permission-delivery-payouts-manage-' || lower(replace(roles."code", '_', '-')),
  roles."id",
  permission."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM roles
CROSS JOIN permission
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

WITH permission AS (
  SELECT "id" FROM "Permission" WHERE "code" = 'delivery.partners.manage'
),
roles AS (
  SELECT "id", "code" FROM "Role"
  WHERE "code" IN ('SUPER_ADMIN', 'DELIVERY_MANAGER', 'WAREHOUSE_MANAGER')
    AND "deletedAt" IS NULL
)
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt", "updatedAt")
SELECT
  'role-permission-delivery-partners-manage-' || lower(replace(roles."code", '_', '-')),
  roles."id",
  permission."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM roles
CROSS JOIN permission
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Warehouse managers dispatch and settle deliveries for their own warehouses.
WITH permission AS (
  SELECT "id" FROM "Permission" WHERE "code" = 'delivery.assign'
),
roles AS (
  SELECT "id" FROM "Role"
  WHERE "code" = 'WAREHOUSE_MANAGER' AND "deletedAt" IS NULL
)
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt", "updatedAt")
SELECT
  'role-permission-delivery-assign-warehouse-manager',
  roles."id",
  permission."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM roles
CROSS JOIN permission
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
