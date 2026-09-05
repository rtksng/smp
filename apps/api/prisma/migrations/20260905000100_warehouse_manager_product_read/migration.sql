-- Let warehouse managers resolve products while reading and updating inventory.
WITH warehouse_manager AS (
  SELECT "id"
  FROM "Role"
  WHERE "code" = 'WAREHOUSE_MANAGER' AND "deletedAt" IS NULL
),
product_read AS (
  SELECT "id"
  FROM "Permission"
  WHERE "code" = 'products.read' AND "deletedAt" IS NULL
)
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt", "updatedAt")
SELECT
  'role-permission-products-read-warehouse-manager',
  warehouse_manager."id",
  product_read."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM warehouse_manager
CROSS JOIN product_read
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
