-- Detect duplicate external identities before applying the provider identity
-- foundation migration.
--
-- Usage:
--   psql "$DATABASE_URL" -f backend/prisma/diagnostics/platform-integration-identity-duplicates.sql
--
-- Any returned row means the global unique index on (platform, externalId)
-- would reject the current data unless the duplicate is corrected first.
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
