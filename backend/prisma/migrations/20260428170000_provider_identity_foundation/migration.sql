-- Provider / identity foundation for connected accounts and future social login.
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'GOOGLE';

CREATE TYPE "PlatformIntegrationConnectionType" AS ENUM ('SOCIAL_LOGIN', 'CONNECTED_ACCOUNT');
CREATE TYPE "PlatformIntegrationStatus" AS ENUM ('CONNECTED', 'NEEDS_REAUTH', 'DISCONNECTED', 'UNAVAILABLE', 'EXPERIMENTAL');
CREATE TYPE "PlatformIntegrationDataSource" AS ENUM ('OFFICIAL', 'MANUAL', 'EXPERIMENTAL', 'LOCAL_COMPANION');

ALTER TABLE "platform_integrations"
  ADD COLUMN "connectionType" "PlatformIntegrationConnectionType" NOT NULL DEFAULT 'CONNECTED_ACCOUNT',
  ADD COLUMN "status" "PlatformIntegrationStatus" NOT NULL DEFAULT 'CONNECTED',
  ADD COLUMN "dataSource" "PlatformIntegrationDataSource" NOT NULL DEFAULT 'OFFICIAL',
  ADD COLUMN "lastSyncAt" TIMESTAMP(3);

-- Legacy EPIC connections used the literal externalId "epic" for every user.
-- Backfill them to a unique, clearly legacy fallback before the global identity
-- index is created. This does not claim to be a real Epic account id; it only
-- preserves the existing connected-account row until a future reconnect can
-- normalize Epic with a trustworthy provider identity.
UPDATE "platform_integrations"
SET
  "externalId" = 'legacy:epic:' || "userId",
  "status" = 'NEEDS_REAUTH',
  "dataSource" = 'EXPERIMENTAL',
  "metadata" = COALESCE("metadata", '{}'::jsonb) || jsonb_build_object(
    'legacyExternalIdBackfilled', true,
    'legacyExternalId', 'epic',
    'requiresReconnectForStableIdentity', true
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "platform" = 'EPIC'
  AND "externalId" = 'epic';

-- Keep the unique index honest: after the known EPIC legacy backfill, any
-- remaining duplicate external identity requires manual data correction.
DO $$
DECLARE
  duplicate_identity RECORD;
BEGIN
  SELECT
    "platform"::text AS platform,
    "externalId" AS external_id,
    COUNT(DISTINCT "userId") AS affected_user_count
  INTO duplicate_identity
  FROM "platform_integrations"
  GROUP BY "platform", "externalId"
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'platform_integrations contains duplicate external identity for platform %, externalId %, affected users %',
      duplicate_identity.platform,
      duplicate_identity.external_id,
      duplicate_identity.affected_user_count
      USING HINT = 'Run backend/prisma/diagnostics/platform-integration-identity-duplicates.sql and resolve duplicates before applying this migration.';
  END IF;
END $$;

CREATE UNIQUE INDEX "platform_integrations_platform_externalId_key"
  ON "platform_integrations"("platform", "externalId");
