-- A Razorpay refund belongs to exactly one refund row, so a retried or
-- concurrent refund attempt can never record the same Razorpay refund twice.
-- Fails if duplicates already exist; resolve those rows before deploying.
CREATE UNIQUE INDEX "Refund_providerRefundId_key" ON "Refund"("providerRefundId");
