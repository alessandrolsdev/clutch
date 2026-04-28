-- Manual pre-deploy diagnostic for duplicate external identities.
--
-- Usage:
--   psql "$DATABASE_URL" -f backend/prisma/diagnostics/platform-integration-identity-duplicates.sql
--
-- Run this before deploy to see whether legacy data would conflict with the
-- global unique index on (platform, externalId). The migration itself also
-- performs the known EPIC legacy backfill first and then runs an internal
-- duplicate guard immediately before creating the index.
--
-- Expected legacy EPIC rows with externalId = 'epic' will appear here before
-- the migration. They are handled automatically by the migration as
-- legacy:epic:<userId>, status NEEDS_REAUTH, dataSource EXPERIMENTAL.
-- Any duplicate row that remains after that backfill requires manual cleanup.
SELECT
  "platform",
  "externalId",
  COUNT(*) AS integration_count,
  COUNT(DISTINCT "userId") AS affected_user_count,
  ARRAY_AGG("userId" ORDER BY "userId") AS affected_user_ids
FROM "platform_integrations"
GROUP BY "platform", "externalId"
HAVING COUNT(*) > 1
ORDER BY affected_user_count DESC, "platform", "externalId";
