import { redis, REDIS_KEYS } from './redis';
import type {
  RefreshSessionRecord,
  RefreshSessionStore,
} from '../../core/services/refresh-token.service';

export function createRedisRefreshSessionStore(): RefreshSessionStore {
  return {
    async get(sessionId: string): Promise<RefreshSessionRecord | null> {
      const payload = await redis.get(REDIS_KEYS.refreshSession(sessionId));

      if (!payload) {
        return null;
      }

      return JSON.parse(payload) as RefreshSessionRecord;
    },

    async set(
      sessionId: string,
      session: RefreshSessionRecord,
      ttlSeconds: number,
    ): Promise<void> {
      await redis.set(
        REDIS_KEYS.refreshSession(sessionId),
        JSON.stringify(session),
        'EX',
        ttlSeconds,
      );
    },

    async delete(sessionId: string): Promise<void> {
      await redis.del(REDIS_KEYS.refreshSession(sessionId));
    },
  };
}
