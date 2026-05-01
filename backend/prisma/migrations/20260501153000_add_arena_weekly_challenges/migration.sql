CREATE TYPE "ArenaChallengeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED');
CREATE TYPE "ArenaProofType" AS ENUM ('GAME_SESSION', 'ACHIEVEMENT', 'COMMUNITY_EVENT_RSVP');

CREATE TABLE "arena_challenges" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "ArenaChallengeStatus" NOT NULL DEFAULT 'ACTIVE',
    "ruleType" "ArenaProofType" NOT NULL,
    "scoreValue" INTEGER NOT NULL DEFAULT 10,
    "maxSubmissionsPerUser" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arena_challenges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "arena_participations" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arena_participations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "arena_submissions" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "participationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "proofType" "ArenaProofType" NOT NULL,
    "proofId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arena_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "arena_challenges_slug_key" ON "arena_challenges"("slug");
CREATE INDEX "arena_challenges_status_startsAt_endsAt_idx" ON "arena_challenges"("status", "startsAt", "endsAt");

CREATE UNIQUE INDEX "arena_participations_challengeId_userId_key" ON "arena_participations"("challengeId", "userId");
CREATE INDEX "arena_participations_userId_idx" ON "arena_participations"("userId");

CREATE UNIQUE INDEX "arena_submissions_challengeId_proofType_proofId_key" ON "arena_submissions"("challengeId", "proofType", "proofId");
CREATE INDEX "arena_submissions_challengeId_userId_idx" ON "arena_submissions"("challengeId", "userId");
CREATE INDEX "arena_submissions_userId_idx" ON "arena_submissions"("userId");

ALTER TABLE "arena_participations" ADD CONSTRAINT "arena_participations_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "arena_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "arena_participations" ADD CONSTRAINT "arena_participations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "arena_submissions" ADD CONSTRAINT "arena_submissions_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "arena_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "arena_submissions" ADD CONSTRAINT "arena_submissions_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "arena_participations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "arena_submissions" ADD CONSTRAINT "arena_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
