-- Products without variants store variantId as NULL, and NULLs never conflict
-- in the existing unique indexes, so two stock rows (or two batches with the
-- same number) could exist for one product in one warehouse. These partial
-- indexes close that gap. They fail if duplicates already exist; see
-- docs/deployment.md for the query that finds them.
CREATE UNIQUE INDEX "InventoryStock_product_warehouse_without_variant_key"
  ON "InventoryStock" ("productId", "warehouseId")
  WHERE "variantId" IS NULL;

CREATE UNIQUE INDEX "StockBatch_product_warehouse_batch_without_variant_key"
  ON "StockBatch" ("productId", "warehouseId", "batchNumber")
  WHERE "variantId" IS NULL;

-- Stock can never go below zero. NOT VALID enforces this for every new write
-- without failing the migration on any old negative rows; validate after
-- fixing them (docs/deployment.md).
ALTER TABLE "InventoryStock"
  ADD CONSTRAINT "InventoryStock_quantities_not_negative"
  CHECK ("availableQuantity" >= 0 AND "reservedQuantity" >= 0) NOT VALID;

ALTER TABLE "StockBatch"
  ADD CONSTRAINT "StockBatch_quantity_not_negative"
  CHECK ("quantity" >= 0) NOT VALID;
