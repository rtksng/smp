-- Keep the hash of the refresh token a session last rotated away from, and
-- when, so a reused old token can be told apart from two tabs refreshing at
-- the same moment.
ALTER TABLE "UserSession"
  ADD COLUMN "previousRefreshToken" TEXT,
  ADD COLUMN "refreshTokenRotatedAt" TIMESTAMP(3);

ALTER TABLE "AdminSession"
  ADD COLUMN "previousRefreshToken" TEXT,
  ADD COLUMN "refreshTokenRotatedAt" TIMESTAMP(3);

ALTER TABLE "DeliveryPartnerSession"
  ADD COLUMN "previousRefreshToken" TEXT,
  ADD COLUMN "refreshTokenRotatedAt" TIMESTAMP(3);
