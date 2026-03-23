import Fastify, { FastifyInstance } from 'fastify';
import { authRoutes }        from '@/api/routes/auth.routes';
import { profileRoutes }     from '@/api/routes/profile.routes';
import { friendRoutes }      from '@/api/routes/friends.routes';
import { presenceRoutes }    from '@/api/routes/presence.routes';
import { integrationRoutes } from '@/api/routes/integrations.routes';
import { postRoutes }        from '@/api/routes/posts.routes';

export const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false });

  await app.register(authRoutes,        { prefix: '/auth' });
  await app.register(profileRoutes,     { prefix: '/profiles' });
  await app.register(friendRoutes,      { prefix: '/friends' });
  await app.register(presenceRoutes,    { prefix: '/presence' });
  await app.register(integrationRoutes, { prefix: '/integrations' });
  await app.register(postRoutes,        { prefix: '/posts' });

  await app.ready();
  return app;
};