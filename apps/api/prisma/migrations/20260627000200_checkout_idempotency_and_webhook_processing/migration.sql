CREATE TYPE "WebhookProcessingStatus" AS ENUM (
  'RECEIVED',
  'PROCESSING',
  'PROCESSED',
  'IGNORED',
  'FAILED'
);

ALTER TABLE "Order"
ADD COLUMN "checkoutIdempotencyKey" TEXT;

ALTER TABLE "Order"
ADD CONSTRAINT "Order_userId_checkoutIdempotencyKey_key"
UNIQUE ("userId", "checkoutIdempotencyKey");

ALTER TABLE "PaymentWebhook"
ADD COLUMN "processingStatus" "WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
ADD COLUMN "processingAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastProcessingError" TEXT;

CREATE INDEX "PaymentWebhook_processingStatus_createdAt_idx"
ON "PaymentWebhook"("processingStatus", "createdAt");
