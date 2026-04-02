import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
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

export type BuildAppOptions = {
  jwtSecret?: string;
  logger?: boolean;
  readinessCheck?: () => Promise<ReadinessReport>;
};

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const requestStartTimes = new WeakMap<object, number>();

  const app = Fastify({
    logger: options.logger === false ? false : createFastifyLoggerOptions(),
    disableRequestLogging: true,
    requestIdHeader: REQUEST_ID_HEADER,
    genReqId: (request) => resolveBackendRequestId(request.headers),
  });

  await app.register(fastifyJwt, {
    secret: options.jwtSecret ?? process.env['JWT_SECRET'] ?? 'clutch-dev-secret-change-in-production',
  });

  app.decorate('authenticate', authenticate);

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
