import Fastify, { FastifyInstance } from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';
import { authRoutes } from './api/routes/auth.routes';
import { profileRoutes } from './api/routes/profile.routes';
import { friendRoutes } from './api/routes/friends.routes';
import { presenceRoutes } from './api/routes/presence.routes';
import { integrationRoutes } from './api/routes/integrations.routes';
import { postRoutes } from './api/routes/posts.routes';
import { notificationRoutes } from './api/routes/notifications.routes';
import { authenticate } from './api/middlewares/authenticate';
import {
  runReadinessChecks,
  type ReadinessReport,
} from './config/health';
import {
  createFastifyLoggerOptions,
  logBackendError,
  REQUEST_ID_HEADER,
  resolveBackendRequestId,
} from './config/logging';
import {
  createJwtSigner,
  type JwtKeyRotationConfig,
  createJwtVerifier,
} from './config/jwt';
import { createAuthRateLimitPluginOptions } from './config/rate-limit';
import {
  createRefreshTokenService,
  type RefreshSessionStore,
} from './core/services/refresh-token.service';
import { createRedisRefreshSessionStore } from './infra/cache/refresh-session.store';
import { redis as runtimeRedis } from './infra/cache/redis';
import type Redis from 'ioredis';

export type BuildAppOptions = {
  jwtSecret?: string;
  jwtKeyRotationConfig?: JwtKeyRotationConfig;
  logger?: boolean;
  readinessCheck?: () => Promise<ReadinessReport>;
  refreshSessionStore?: RefreshSessionStore;
  rateLimitRedis?: Redis | null;
};

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const requestStartTimes = new WeakMap<object, number>();

  const app = Fastify({
    logger: options.logger === false ? false : createFastifyLoggerOptions(),
    disableRequestLogging: true,
    requestIdHeader: REQUEST_ID_HEADER,
    genReqId: (request) => resolveBackendRequestId(request.headers),
    trustProxy: 'loopback, linklocal, uniquelocal',
  });
  const jwtConfigInput = options.jwtKeyRotationConfig ?? options.jwtSecret;
  const signAccessToken = createJwtSigner(jwtConfigInput);
  const verifyAccessToken = createJwtVerifier(jwtConfigInput);
  const refreshTokenService = createRefreshTokenService({
    jwtSecret: options.jwtSecret,
    jwtKeyRotationConfig: options.jwtKeyRotationConfig,
    refreshSessionStore: options.refreshSessionStore ?? createRedisRefreshSessionStore(),
  });

  app.decorate('authenticate', authenticate);
  app.decorate('signAccessToken', signAccessToken);
  app.decorate('verifyAccessToken', verifyAccessToken);
  app.decorate('refreshTokenService', refreshTokenService);

  await app.register(
    fastifyRateLimit,
    createAuthRateLimitPluginOptions(
      options.rateLimitRedis ?? (process.env['NODE_ENV'] === 'test' ? null : runtimeRedis),
    ),
  );

  const readinessCheck = options.readinessCheck ?? runReadinessChecks;

  app.addHook('onRequest', async (request) => {
    requestStartTimes.set(request, Date.now());
    request.log.info(
      {
        event: 'http_request_start',
        requestId: request.id,
        method: request.method,
        path: request.url,
      },
      'HTTP request started',
    );
  });

  app.addHook('onResponse', async (request, reply) => {
    const startedAt = requestStartTimes.get(request) ?? Date.now();

    request.log.info(
      {
        event: 'http_request_complete',
        requestId: request.id,
        method: request.method,
        path: request.url,
        status: reply.statusCode,
        duration_ms: Math.max(Date.now() - startedAt, 0),
      },
      'HTTP request completed',
    );
  });

  app.addHook('onError', async (request, reply, error) => {
    const startedAt = requestStartTimes.get(request) ?? Date.now();

    logBackendError(
      request.log,
      'http_request_error',
      'HTTP request failed',
      error,
      {
        requestId: request.id,
        method: request.method,
        path: request.url,
        status: reply.statusCode >= 400 ? reply.statusCode : 500,
        duration_ms: Math.max(Date.now() - startedAt, 0),
      },
    );
  });

  app.get('/health', async () => ({
    status: 'ok',
  }));

  app.get('/health/live', async () => ({
    status: 'ok',
  }));

  app.get('/health/ready', async (_request, reply) => {
    const readiness = await readinessCheck();

    if (readiness.status === 'error') {
      return reply.status(503).send(readiness);
    }

    return reply.status(200).send(readiness);
  });

  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(profileRoutes, { prefix: '/profiles' });
  await app.register(friendRoutes, { prefix: '/friends' });
  await app.register(presenceRoutes, { prefix: '/presence' });
  await app.register(integrationRoutes, { prefix: '/integrations' });
  await app.register(postRoutes, { prefix: '/posts' });
  await app.register(notificationRoutes, { prefix: '/notifications' });

  await app.ready();

  return app;
}
