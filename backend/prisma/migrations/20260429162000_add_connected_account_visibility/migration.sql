ALTER TABLE "platform_integrations"
ADD COLUMN "publicProfileVisible" BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN "platform_integrations"."publicProfileVisible"
IS 'Controls whether a connected account can appear on the public profile. Default is private for existing and new accounts.';
