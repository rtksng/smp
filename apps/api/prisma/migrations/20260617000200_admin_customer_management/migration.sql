-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE';

UPDATE "User"
SET "status" = CASE
  WHEN "isActive" = true THEN 'ACTIVE'::"CustomerStatus"
  ELSE 'INACTIVE'::"CustomerStatus"
END;

-- CreateTable
CREATE TABLE "CustomerSupportNote" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "adminUserId" TEXT,
  "note" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerSupportNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "CustomerSupportNote_customerId_idx" ON "CustomerSupportNote"("customerId");

-- CreateIndex
CREATE INDEX "CustomerSupportNote_adminUserId_idx" ON "CustomerSupportNote"("adminUserId");

-- CreateIndex
CREATE INDEX "CustomerSupportNote_createdAt_idx" ON "CustomerSupportNote"("createdAt");

-- AddForeignKey
ALTER TABLE "CustomerSupportNote" ADD CONSTRAINT "CustomerSupportNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSupportNote" ADD CONSTRAINT "CustomerSupportNote_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SeedPermission
INSERT INTO "Permission" ("id", "name", "code", "description", "createdAt", "updatedAt")
VALUES (
  'permission-users-update',
  'Update users',
  'users.update',
  'Update customer account status and support notes.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE SET
  "deletedAt" = NULL,
  "description" = EXCLUDED."description",
  "name" = EXCLUDED."name",
  "updatedAt" = CURRENT_TIMESTAMP;

-- SeedRolePermissions
WITH permission AS (
  SELECT "id" FROM "Permission" WHERE "code" = 'users.update'
),
roles AS (
  SELECT "id", "code" FROM "Role"
  WHERE "code" IN ('SUPER_ADMIN', 'ORDER_MANAGER', 'SUPPORT')
)
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt", "updatedAt")
SELECT
  'role-permission-users-update-' || lower(replace(roles."code", '_', '-')),
  roles."id",
  permission."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM roles
CROSS JOIN permission
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
