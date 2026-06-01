ALTER TABLE "Product" ADD COLUMN "subcategoryId" TEXT;

UPDATE "Product" AS p
SET "subcategoryId" = p."categoryId",
    "categoryId" = c."parentId"
FROM "Category" AS c
WHERE p."categoryId" = c."id"
  AND c."parentId" IS NOT NULL;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_subcategoryId_fkey"
  FOREIGN KEY ("subcategoryId")
  REFERENCES "Category"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "Product_subcategoryId_idx" ON "Product"("subcategoryId");
CREATE INDEX "Product_subcategoryId_status_deletedAt_idx" ON "Product"("subcategoryId", "status", "deletedAt");
