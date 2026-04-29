import { Profile, type Platform, type PlatformIntegrationConnectionType } from '@prisma/client';
import { prisma } from '../../infra/database/client';
import { getProviderDefinition } from '../providers/provider-registry';

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

export interface FullProfileRecord {
  id: string;
  username: string;
  createdAt: Date;
  profile: {
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    accentColor: string | null;
    badges: string[];
  };
  stats: {
    level: number;
    xp: number;
    reputation: number;
    friendCount: number;
    postCount: number;
  };
  presence: {
    status: string;
    currentGame: string | null;
    gameDetails: Record<string, unknown> | null;
    platform: string | null;
    updatedAt: Date;
  };
  platformIntegrations: Array<{
    platform: Platform;
    displayName: string;
    connectionType: PlatformIntegrationConnectionType;
  }>;
  gameLibrary: Array<{
    gameName: string;
    coverUrl: string | null;
    platform: string;
    hoursPlayed: number | null;
    lastPlayedAt: Date | null;
  }>;
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
        },
      },
    });

    return user?.profile ?? null;
  },

  async findFullProfileByUsername(username: string): Promise<FullProfileRecord | null> {
    const user = await prisma.user.findUnique({
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
          where: {
            isActive: true,
            publicProfileVisible: true,
            status: 'CONNECTED',
            dataSource: 'OFFICIAL',
          },
          select: {
            platform: true,
            connectionType: true,
          },
        },
        gameLibrary: {
          orderBy: { lastPlayedAt: 'desc' },
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

    if (!user) {
      return null;
    }

    return {
      ...user,
      platformIntegrations: user.platformIntegrations.map((integration) => ({
        platform: integration.platform,
        displayName: getProviderDefinition(integration.platform).displayName,
        connectionType: integration.connectionType,
      })),
    } as FullProfileRecord;
  },

  async updateByUserId(userId: string, input: UpdateProfileInput): Promise<Profile> {
    return prisma.profile.update({
      where: { userId },
      data: input,
    });
  },
};
