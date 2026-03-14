import Fastify, { FastifyInstance } from 'fastify';
import { authRoutes }    from '@/api/routes/auth.routes';
import { profileRoutes } from '@/api/routes/profile.routes';
import { friendRoutes }  from '@/api/routes/friends.routes';

// ─────────────────────────────────────────────────────────────
// Builds a Fastify instance with all routes registered
// Used exclusively in integration tests
// ─────────────────────────────────────────────────────────────

export const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false });

  await app.register(authRoutes,    { prefix: '/auth' });
  await app.register(profileRoutes, { prefix: '/profiles' });
  await app.register(friendRoutes,  { prefix: '/friends' });

  await app.ready();
  return app;
};