import { PresenceStatus } from '@prisma/client';
import { prisma } from '@/infra/database/client';
import { redis, REDIS_KEYS, REDIS_TTL } from '@/infra/cache/redis';

// ─────────────────────────────────────────────────────────────
// Presence Repository — Dual-layer Redis + Postgres
// Redis → leitura rápida com TTL de 5 min
// Postgres → persistência e histórico
// ─────────────────────────────────────────────────────────────

export interface PresenceData {
  userId:      string;
  status:      PresenceStatus;
  currentGame: string | null;
  gameDetails: Record<string, unknown> | null;
  platform:    string | null;
  updatedAt:   string;
}

export interface SetPresenceInput {
  status:       PresenceStatus;
  currentGame?: string | null;
  gameDetails?: Record<string, unknown> | null;
  platform?:    string | null;
}

export const presenceRepository = {

  async set(userId: string, input: SetPresenceInput): Promise<void> {
    const data: PresenceData = {
      userId,
      status:      input.status,
      currentGame: input.currentGame ?? null,
      gameDetails: input.gameDetails ?? null,
      platform:    input.platform    ?? null,
      updatedAt:   new Date().toISOString(),
    };

    // ── Redis (TTL 5 min) ──────────────────────────────────
    await redis.setex(
      REDIS_KEYS.presence(userId),
      REDIS_TTL.presence,
      JSON.stringify(data),
    );

    // ── Postgres (persistência) ────────────────────────────
    await prisma.userPresence.upsert({
      where:  { userId },
      create: {
        userId,
        status:      input.status,
        currentGame: input.currentGame ?? null,
        gameDetails: input.gameDetails
          ? JSON.parse(JSON.stringify(input.gameDetails))
          : undefined,
        platform: input.platform ?? null,
      },
      update: {
        status:      input.status,
        currentGame: input.currentGame ?? null,
        gameDetails: input.gameDetails
          ? JSON.parse(JSON.stringify(input.gameDetails))
          : undefined,
        platform: input.platform ?? null,
      },
    });

    // ── Pub/Sub → Go service ───────────────────────────────
    await redis.publish(
      REDIS_KEYS.presenceUpdate,
      JSON.stringify(data),
    );
  },

  async get(userId: string): Promise<PresenceData> {
    // ── Tenta Redis primeiro ───────────────────────────────
    const cached = await redis.get(REDIS_KEYS.presence(userId));
    if (cached) {
      return JSON.parse(cached) as PresenceData;
    }

    // ── Fallback para Postgres ─────────────────────────────
    const presence = await prisma.userPresence.findUnique({
      where: { userId },
    });

    if (!presence) {
      return {
        userId,
        status:      'OFFLINE',
        currentGame: null,
        gameDetails: null,
        platform:    null,
        updatedAt:   new Date().toISOString(),
      };
    }

    return {
      userId,
      status:      presence.status,
      currentGame: presence.currentGame,
      gameDetails: presence.gameDetails as Record<string, unknown> | null,
      platform:    presence.platform,
      updatedAt:   presence.updatedAt.toISOString(),
    };
  },

  async setOffline(userId: string): Promise<void> {
    // ── Remove do Redis ────────────────────────────────────
    await redis.del(REDIS_KEYS.presence(userId));

    // ── Atualiza Postgres ──────────────────────────────────
    await prisma.userPresence.upsert({
      where:  { userId },
      create: { userId, status: 'OFFLINE' },
      update: { status: 'OFFLINE', currentGame: null, platform: null },
    });

    // ── Publica OFFLINE no Pub/Sub ─────────────────────────
    await redis.publish(
      REDIS_KEYS.presenceUpdate,
      JSON.stringify({
        userId,
        status:      'OFFLINE',
        currentGame: null,
        gameDetails: null,
        platform:    null,
        updatedAt:   new Date().toISOString(),
      }),
    );
  },

  async getFriendsPresence(userIds: string[]): Promise<PresenceData[]> {
    if (userIds.length === 0) return [];

    // ── Bulk get via Redis pipeline ────────────────────────
    const pipeline = redis.pipeline();
    for (const userId of userIds) {
      pipeline.get(REDIS_KEYS.presence(userId));
    }

    const results = await pipeline.exec();
    const presences: PresenceData[] = [];

    results?.forEach((result, index) => {
      const userId = userIds[index];
      if (!userId) return;

      const [err, value] = result;
      if (!err && value) {
        presences.push(JSON.parse(value as string) as PresenceData);
      } else {
        presences.push({
          userId,
          status:      'OFFLINE',
          currentGame: null,
          gameDetails: null,
          platform:    null,
          updatedAt:   new Date().toISOString(),
        });
      }
    });

    return presences;
  },

};