CREATE INDEX "UserSession_revokedAt_expiresAt_idx" ON "UserSession"("revokedAt", "expiresAt");
CREATE INDEX "AdminSession_revokedAt_expiresAt_idx" ON "AdminSession"("revokedAt", "expiresAt");

CREATE INDEX "StockBatch_warehouseId_expiryDate_quantity_idx" ON "StockBatch"("warehouseId", "expiryDate", "quantity");
CREATE INDEX "StockBatch_productId_warehouseId_expiryDate_idx" ON "StockBatch"("productId", "warehouseId", "expiryDate");

CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");
CREATE INDEX "StockMovement_warehouseId_createdAt_idx" ON "StockMovement"("warehouseId", "createdAt");
CREATE INDEX "StockMovement_productId_warehouseId_createdAt_idx" ON "StockMovement"("productId", "warehouseId", "createdAt");
CREATE INDEX "StockMovement_referenceType_referenceId_idx" ON "StockMovement"("referenceType", "referenceId");

CREATE INDEX "Cart_userId_createdAt_idx" ON "Cart"("userId", "createdAt");

CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX "Order_paymentStatus_createdAt_idx" ON "Order"("paymentStatus", "createdAt");
CREATE INDEX "Order_warehouseId_status_createdAt_idx" ON "Order"("warehouseId", "status", "createdAt");

CREATE INDEX "PaymentWebhook_provider_eventType_createdAt_idx" ON "PaymentWebhook"("provider", "eventType", "createdAt");

CREATE INDEX "DeliveryAssignment_deliveryPartnerId_status_idx" ON "DeliveryAssignment"("deliveryPartnerId", "status");
CREATE INDEX "DeliveryAssignment_pickupWarehouseId_status_idx" ON "DeliveryAssignment"("pickupWarehouseId", "status");
CREATE INDEX "DeliveryAssignment_status_assignedAt_idx" ON "DeliveryAssignment"("status", "assignedAt");

CREATE INDEX "NotificationLog_channel_status_createdAt_idx" ON "NotificationLog"("channel", "status", "createdAt");

CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
CREATE INDEX "AdminAuditLog_adminUserId_createdAt_idx" ON "AdminAuditLog"("adminUserId", "createdAt");
CREATE INDEX "AdminAuditLog_entityType_createdAt_idx" ON "AdminAuditLog"("entityType", "createdAt");
