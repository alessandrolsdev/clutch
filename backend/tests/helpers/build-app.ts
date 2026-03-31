import { FastifyInstance } from 'fastify';
import { buildApp as createApp } from '../../src/app';

export const TEST_JWT_SECRET = 'clutch-test-secret';

export const buildApp = async (): Promise<FastifyInstance> => {
  return createApp({
    jwtSecret: TEST_JWT_SECRET,
    logger: false,
  });
};

export const generateTestToken = (app: FastifyInstance, userId = 'user-id-1', username = 'clutchplayer'): string => {
  return app.jwt.sign({ id: userId, username });
};
