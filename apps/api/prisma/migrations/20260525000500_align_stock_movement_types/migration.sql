-- Align stock movement types with the warehouse and inventory API language.
ALTER TYPE "StockMovementType" RENAME TO "StockMovementType_old";

CREATE TYPE "StockMovementType" AS ENUM (
  'IN',
  'OUT',
  'ADJUSTMENT',
  'TRANSFER',
  'RETURN'
);

ALTER TABLE "StockMovement"
  ALTER COLUMN "type" TYPE "StockMovementType"
  USING (
    CASE "type"::text
      WHEN 'PURCHASE' THEN 'IN'
      WHEN 'TRANSFER_IN' THEN 'IN'
      WHEN 'SALE' THEN 'OUT'
      WHEN 'TRANSFER_OUT' THEN 'OUT'
      WHEN 'EXPIRED' THEN 'OUT'
      WHEN 'DAMAGED' THEN 'OUT'
      WHEN 'RETURN' THEN 'RETURN'
      WHEN 'ADJUSTMENT' THEN 'ADJUSTMENT'
      ELSE 'ADJUSTMENT'
    END
  )::"StockMovementType";

DROP TYPE "StockMovementType_old";

ALTER TABLE "StockMovement" ADD COLUMN "metadata" JSONB;
