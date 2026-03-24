import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { authRoutes }          from '@/api/routes/auth.routes';
import { profileRoutes }       from '@/api/routes/profile.routes';
import { friendRoutes }        from '@/api/routes/friends.routes';
import { presenceRoutes }      from '@/api/routes/presence.routes';
import { integrationRoutes }   from '@/api/routes/integrations.routes';
import { postRoutes }          from '@/api/routes/posts.routes';
import { notificationRoutes }  from '@/api/routes/notifications.routes';
import { authenticate }        from '@/api/middlewares/authenticate';

// ─────────────────────────────────────────────────────────────
// Test app builder — JWT com secret fixo para testes
// ─────────────────────────────────────────────────────────────

export const TEST_JWT_SECRET = 'clutch-test-secret';

export const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false });

  await app.register(fastifyJwt, { secret: TEST_JWT_SECRET });
  app.decorate('authenticate', authenticate);

  await app.register(authRoutes,         { prefix: '/auth' });
  await app.register(profileRoutes,      { prefix: '/profiles' });
  await app.register(friendRoutes,       { prefix: '/friends' });
  await app.register(presenceRoutes,     { prefix: '/presence' });
  await app.register(integrationRoutes,  { prefix: '/integrations' });
  await app.register(postRoutes,         { prefix: '/posts' });
  await app.register(notificationRoutes, { prefix: '/notifications' });

  await app.ready();
  return app;
};

// Helper para gerar token de teste
export const generateTestToken = (app: FastifyInstance, userId = 'user-id-1', username = 'clutchplayer'): string => {
  return app.jwt.sign({ id: userId, username });
};