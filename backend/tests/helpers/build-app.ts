import { FastifyInstance } from 'fastify';
import {
  buildApp as createApp,
  type BuildAppOptions,
} from '../../src/app';
import { createInMemoryRefreshSessionStore } from '../../src/core/services/refresh-token.service';

export const TEST_JWT_SECRET = 'clutch-test-secret';

export const buildApp = async (
  options: Omit<BuildAppOptions, 'jwtSecret' | 'logger'> = {},
): Promise<FastifyInstance> => {
  return createApp({
    jwtSecret: TEST_JWT_SECRET,
    logger: false,
    refreshSessionStore: createInMemoryRefreshSessionStore(),
    ...options,
  });
};

export const generateTestToken = (app: FastifyInstance, userId = 'user-id-1', username = 'clutchplayer'): string => {
  return app.signAccessToken({ id: userId, username });
};
