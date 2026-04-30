-- Adds stable external identifiers for imported media titles and basic per-user progress.
-- Existing media titles remain local/private because externalSource and externalId stay null.
ALTER TABLE "media_titles"
  ADD COLUMN "externalSource" "Platform",
  ADD COLUMN "externalId" TEXT;

CREATE UNIQUE INDEX "media_titles_externalSource_externalId_kind_key"
  ON "media_titles"("externalSource", "externalId", "kind");

ALTER TABLE "user_media_entries"
  ADD COLUMN "progress" INTEGER,
  ADD COLUMN "score" INTEGER;
