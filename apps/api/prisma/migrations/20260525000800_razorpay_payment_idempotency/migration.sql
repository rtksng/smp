DROP INDEX IF EXISTS "Payment_providerPaymentId_idx";

ALTER TABLE "Payment"
  ADD COLUMN "providerAmountPaise" INTEGER;

CREATE UNIQUE INDEX "Payment_providerOrderId_key" ON "Payment"("providerOrderId");
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");

ALTER TABLE "PaymentWebhook"
  ADD COLUMN "providerEventId" TEXT,
  ADD COLUMN "rawPayload" TEXT;

CREATE UNIQUE INDEX "PaymentWebhook_providerEventId_key" ON "PaymentWebhook"("providerEventId");
