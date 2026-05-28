UPDATE "Product"
SET "status" = 'INACTIVE'
WHERE "status" = 'DISCONTINUED';

UPDATE "ProductVariant"
SET "status" = 'INACTIVE'
WHERE "status" = 'DISCONTINUED';

ALTER TYPE "ProductStatus" RENAME TO "ProductStatus_old";

CREATE TYPE "ProductStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'INACTIVE',
  'OUT_OF_STOCK'
);

ALTER TABLE "Product" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Product"
  ALTER COLUMN "status" TYPE "ProductStatus"
  USING ("status"::text::"ProductStatus");
ALTER TABLE "Product" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

ALTER TABLE "ProductVariant" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ProductVariant"
  ALTER COLUMN "status" TYPE "ProductStatus"
  USING ("status"::text::"ProductStatus");
ALTER TABLE "ProductVariant" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

DROP TYPE "ProductStatus_old";

ALTER TYPE "ProductDocumentType" ADD VALUE IF NOT EXISTS 'COMPLIANCE';

CREATE INDEX "Product_name_idx" ON "Product"("name");
CREATE INDEX "Product_sellingPrice_idx" ON "Product"("sellingPrice");
CREATE INDEX "Product_expirySensitive_idx" ON "Product"("expirySensitive");
CREATE INDEX "Product_sterile_idx" ON "Product"("sterile");
CREATE INDEX "Product_disposable_idx" ON "Product"("disposable");
CREATE INDEX "Product_medicalSpecialty_idx" ON "Product"("medicalSpecialty");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");
CREATE INDEX "Product_searchTags_idx" ON "Product" USING GIN ("searchTags");
CREATE INDEX "Product_status_deletedAt_createdAt_idx" ON "Product"("status", "deletedAt", "createdAt");
CREATE INDEX "Product_status_deletedAt_sellingPrice_idx" ON "Product"("status", "deletedAt", "sellingPrice");
CREATE INDEX "Product_brandId_status_deletedAt_idx" ON "Product"("brandId", "status", "deletedAt");
CREATE INDEX "Product_categoryId_status_deletedAt_idx" ON "Product"("categoryId", "status", "deletedAt");
