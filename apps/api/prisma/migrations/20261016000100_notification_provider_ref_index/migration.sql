-- Worker notifications and customer emails deduplicate by providerRef.
CREATE INDEX "NotificationLog_providerRef_idx" ON "NotificationLog"("providerRef");
