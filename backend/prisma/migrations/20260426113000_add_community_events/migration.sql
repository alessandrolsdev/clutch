CREATE TYPE "CommunityEventStatus" AS ENUM ('PUBLISHED', 'CANCELLED');
CREATE TYPE "CommunityEventRsvpStatus" AS ENUM ('GOING', 'INTERESTED', 'NOT_GOING');

CREATE TABLE "community_events" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "status" "CommunityEventStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "community_event_rsvps" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "CommunityEventRsvpStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_event_rsvps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "community_events_communityId_status_startsAt_idx" ON "community_events"("communityId", "status", "startsAt");
CREATE INDEX "community_event_rsvps_userId_idx" ON "community_event_rsvps"("userId");
CREATE UNIQUE INDEX "community_event_rsvps_eventId_userId_key" ON "community_event_rsvps"("eventId", "userId");

ALTER TABLE "community_events" ADD CONSTRAINT "community_events_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_events" ADD CONSTRAINT "community_events_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_event_rsvps" ADD CONSTRAINT "community_event_rsvps_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "community_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_event_rsvps" ADD CONSTRAINT "community_event_rsvps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
