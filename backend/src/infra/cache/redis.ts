import Redis from 'ioredis';

// ─────────────────────────────────────────────────────────────
// Redis Client — Singleton
// Usado para cache de presença e pub/sub de notificações
// ─────────────────────────────────────────────────────────────

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    enableReadyCheck:     true,
    lazyConnect:          false,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

// Chaves Redis
export const REDIS_KEYS = {
  presence:       (userId: string) => `presence:${userId}`,
  presenceFeed:   (userId: string) => `realtime:presence:${userId}`,
  notifications:  (userId: string) => `notifications:${userId}`,
  friendsList:    (userId: string) => `friends:${userId}`,
  presenceUpdate: 'presence:updates',
} as const;

// TTL em segundos
export const REDIS_TTL = {
  presence: 300, // 5 minutos
} as const;
