import { prisma } from '../../infra/database/client';
import { friendRepository } from '../repositories/friend.repository';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type QualifyingActivityRecord = {
  userId: string;
  createdAt: Date;
};

export interface StrongestFriendOffensive {
  friendId: string;
  friendUsername: string;
  days: number;
  lastQualifiedAt: string;
}

export interface SocialContinuitySummary {
  currentStreakDays: number;
  activeFriendOffensiveCount: number;
  strongestFriendOffensive: StrongestFriendOffensive | null;
}

function toUtcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function currentUtcDayKey(): string {
  return toUtcDayKey(new Date());
}

function utcDayKeyToEpochDay(dayKey: string): number {
  const parts = dayKey.split('-');
  if (parts.length !== 3) {
    return 0;
  }

  const [yearText, monthText, dayText] = parts as [string, string, string];
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);

  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

function daysBetweenUtcDayKeys(laterDayKey: string, earlierDayKey: string): number {
  return utcDayKeyToEpochDay(laterDayKey) - utcDayKeyToEpochDay(earlierDayKey);
}

function buildQualifyingDayMap(
  userIds: string[],
  activities: QualifyingActivityRecord[],
): Map<string, string[]> {
  const daySets = new Map<string, Set<string>>();

  for (const userId of userIds) {
    daySets.set(userId, new Set<string>());
  }

  for (const activity of activities) {
    const userDays = daySets.get(activity.userId);
    if (!userDays) {
      continue;
    }

    userDays.add(toUtcDayKey(activity.createdAt));
  }

  return new Map(
    userIds.map((userId) => {
      const days = Array.from(daySets.get(userId) ?? []);
      days.sort((left, right) => daysBetweenUtcDayKeys(right, left));
      return [userId, days];
    }),
  );
}

function calculateActiveStreakDays(
  dayKeys: string[],
  referenceDayKey = currentUtcDayKey(),
): number {
  if (dayKeys.length === 0) {
    return 0;
  }

  const latestDayKey = dayKeys[0]!;
  if (daysBetweenUtcDayKeys(referenceDayKey, latestDayKey) > 1) {
    return 0;
  }

  let streakDays = 1;

  for (let index = 1; index < dayKeys.length; index += 1) {
    const previousDayKey = dayKeys[index - 1]!;
    const currentDayKey = dayKeys[index]!;

    if (daysBetweenUtcDayKeys(previousDayKey, currentDayKey) !== 1) {
      break;
    }

    streakDays += 1;
  }

  return streakDays;
}

function calculateSharedOffensive(
  userDayKeys: string[],
  friendDayKeys: string[],
  referenceDayKey = currentUtcDayKey(),
): { days: number; lastQualifiedAt: string | null } {
  if (userDayKeys.length === 0 || friendDayKeys.length === 0) {
    return { days: 0, lastQualifiedAt: null };
  }

  const friendDays = new Set(friendDayKeys);
  const sharedDayKeys = userDayKeys.filter((dayKey) => friendDays.has(dayKey));

  if (sharedDayKeys.length === 0) {
    return { days: 0, lastQualifiedAt: null };
  }

  const days = calculateActiveStreakDays(sharedDayKeys, referenceDayKey);
  const lastQualifiedAt =
    days > 0 ? new Date(`${sharedDayKeys[0]!}T00:00:00.000Z`).toISOString() : null;

  return { days, lastQualifiedAt };
}

export const socialContinuityService = {
  async summarizeUser(userId: string): Promise<SocialContinuitySummary> {
    const friends = await friendRepository.findFriendsByUserId(userId);
    const friendIds = friends.map((friend) => friend.id);
    const trackedUserIds = [userId, ...friendIds];

    const [posts, comments] = await Promise.all([
      prisma.post.findMany({
        where: { userId: { in: trackedUserIds } },
        select: { userId: true, createdAt: true },
      }),
      prisma.comment.findMany({
        where: { userId: { in: trackedUserIds } },
        select: { userId: true, createdAt: true },
      }),
    ]);

    const qualifyingDayMap = buildQualifyingDayMap(trackedUserIds, [...posts, ...comments]);
    const userDayKeys = qualifyingDayMap.get(userId) ?? [];
    const currentStreakDays = calculateActiveStreakDays(userDayKeys);

    let activeFriendOffensiveCount = 0;
    let strongestFriendOffensive: StrongestFriendOffensive | null = null;

    for (const friend of friends) {
      const friendDayKeys = qualifyingDayMap.get(friend.id) ?? [];
      const offensive = calculateSharedOffensive(userDayKeys, friendDayKeys);

      if (offensive.days === 0 || !offensive.lastQualifiedAt) {
        continue;
      }

      activeFriendOffensiveCount += 1;

      if (
        !strongestFriendOffensive ||
        offensive.days > strongestFriendOffensive.days ||
        (
          offensive.days === strongestFriendOffensive.days &&
          offensive.lastQualifiedAt > strongestFriendOffensive.lastQualifiedAt
        )
      ) {
        strongestFriendOffensive = {
          friendId: friend.id,
          friendUsername: friend.username,
          days: offensive.days,
          lastQualifiedAt: offensive.lastQualifiedAt,
        };
      }
    }

    return {
      currentStreakDays,
      activeFriendOffensiveCount,
      strongestFriendOffensive,
    };
  },
};
