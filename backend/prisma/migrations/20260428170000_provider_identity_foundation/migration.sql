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

CREATE UNIQUE INDEX "platform_integrations_platform_externalId_key"
  ON "platform_integrations"("platform", "externalId");
