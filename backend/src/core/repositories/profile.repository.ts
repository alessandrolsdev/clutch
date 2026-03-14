import { Profile } from '@prisma/client';
import { prisma } from '@/infra/database/client';

// ─────────────────────────────────────────────────────────────
// Profile Repository
// ─────────────────────────────────────────────────────────────

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  accentColor?: string;
}

export const profileRepository = {
  async findByUsername(username: string): Promise<Profile | null> {
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        profile: true,
        stats: true,
        presence: true,
        platformIntegrations: {
          where: { isActive: true },
          select: { platform: true, externalId: true, metadata: true },
        },
        gameLibrary: {
          orderBy: { lastPlayedAt: 'desc' },
          take: 10,
        },
      },
    });

    return user?.profile ?? null;
  },

  async findFullProfileByUsername(username: string): Promise<object | null> {
    return prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        createdAt: true,
        profile: {
          select: {
            displayName: true,
            bio: true,
            avatarUrl: true,
            bannerUrl: true,
            accentColor: true,
            badges: true,
          },
        },
        stats: {
          select: {
            level: true,
            xp: true,
            reputation: true,
            friendCount: true,
            postCount: true,
          },
        },
        presence: {
          select: {
            status: true,
            currentGame: true,
            gameDetails: true,
            platform: true,
            updatedAt: true,
          },
        },
        platformIntegrations: {
          where: { isActive: true },
          select: { platform: true, metadata: true },
        },
        gameLibrary: {
          orderBy: { lastPlayedAt: 'desc' },
          take: 10,
          select: {
            gameName: true,
            coverUrl: true,
            platform: true,
            hoursPlayed: true,
            lastPlayedAt: true,
          },
        },
      },
    });
  },

  async updateByUserId(userId: string, input: UpdateProfileInput): Promise<Profile> {
    return prisma.profile.update({
      where: { userId },
      data: input,
    });
  },
};
