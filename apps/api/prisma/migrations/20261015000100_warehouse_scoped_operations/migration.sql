-- Products are visible to, stocked by, and fulfilled from only the warehouses they are assigned to.
CREATE TABLE "ProductWarehouse" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductWarehouse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductWarehouse_productId_warehouseId_key"
  ON "ProductWarehouse"("productId", "warehouseId");
CREATE INDEX "ProductWarehouse_warehouseId_idx"
  ON "ProductWarehouse"("warehouseId");

ALTER TABLE "ProductWarehouse"
  ADD CONSTRAINT "ProductWarehouse_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductWarehouse"
  ADD CONSTRAINT "ProductWarehouse_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep current operations working: assign each product to every warehouse that
-- already holds its stock, batches, or movement history. Products with no stock
-- anywhere stay unassigned until a super admin assigns them.
INSERT INTO "ProductWarehouse" ("id", "productId", "warehouseId", "createdAt", "updatedAt")
SELECT
  'pw-' || md5(links."productId" || ':' || links."warehouseId"),
  links."productId",
  links."warehouseId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT "productId", "warehouseId" FROM "InventoryStock"
  UNION
  SELECT "productId", "warehouseId" FROM "StockBatch"
  UNION
  SELECT "productId", "warehouseId" FROM "StockMovement"
) links
JOIN "Product" p ON p."id" = links."productId" AND p."deletedAt" IS NULL
JOIN "Warehouse" w ON w."id" = links."warehouseId" AND w."deletedAt" IS NULL
ON CONFLICT ("productId", "warehouseId") DO NOTHING;

-- Only the super admin creates and configures warehouses.
DELETE FROM "RolePermission" rp
USING "Role" r, "Permission" p
WHERE rp."roleId" = r."id"
  AND rp."permissionId" = p."id"
  AND r."code" <> 'SUPER_ADMIN'
  AND p."code" = 'warehouse.manage';

-- Warehouse staff run day-to-day stock and dispatch work. Warehouse managers can
-- create these accounts for their own warehouses. Role ids are validated as
-- UUIDs when admin users are created, so this one is generated the same way.
INSERT INTO "Role" ("id", "name", "code", "description", "isSystem", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Warehouse staff',
  'WAREHOUSE_STAFF',
  'Handles stock and dispatch work at assigned warehouses.',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

WITH role AS (
  SELECT "id" FROM "Role" WHERE "code" = 'WAREHOUSE_STAFF' AND "deletedAt" IS NULL
),
permissions AS (
  SELECT "id", "code" FROM "Permission"
  WHERE "code" IN (
    'products.read',
    'inventory.read',
    'inventory.update',
    'warehouse.read',
    'delivery.read',
    'delivery.assign',
    'reports.read'
  )
    AND "deletedAt" IS NULL
)
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt", "updatedAt")
SELECT
  'role-permission-warehouse-staff-' || replace(permissions."code", '.', '-'),
  role."id",
  permissions."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM role
CROSS JOIN permissions
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
