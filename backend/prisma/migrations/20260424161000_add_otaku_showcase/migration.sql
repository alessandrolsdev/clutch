-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('ANIME', 'MANGA');

-- CreateEnum
CREATE TYPE "MediaConsumptionStatus" AS ENUM ('PLANNING', 'CONSUMING', 'COMPLETED', 'PAUSED', 'DROPPED');

-- CreateTable
CREATE TABLE "media_titles" (
    "id" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "canonicalTitle" TEXT NOT NULL,
    "coverUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_titles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_media_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaTitleId" TEXT NOT NULL,
    "status" "MediaConsumptionStatus" NOT NULL,
    "showcaseRank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_media_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_media_entries_userId_mediaTitleId_key" ON "user_media_entries"("userId", "mediaTitleId");

-- CreateIndex
CREATE INDEX "user_media_entries_userId_showcaseRank_idx" ON "user_media_entries"("userId", "showcaseRank");

-- AddForeignKey
ALTER TABLE "user_media_entries" ADD CONSTRAINT "user_media_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_media_entries" ADD CONSTRAINT "user_media_entries_mediaTitleId_fkey" FOREIGN KEY ("mediaTitleId") REFERENCES "media_titles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
