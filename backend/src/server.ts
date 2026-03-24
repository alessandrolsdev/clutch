import Fastify from 'fastify';
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
// CLUTCH ⚡ — Entry point
// ─────────────────────────────────────────────────────────────

const app = Fastify({ logger: true });

// ── JWT Plugin ────────────────────────────────────────────────
await app.register(fastifyJwt, {
  secret: process.env['JWT_SECRET'] ?? 'clutch-dev-secret-change-in-production',
});

// ── Decorator: app.authenticate ───────────────────────────────
app.decorate('authenticate', authenticate);

// ── Health check ──────────────────────────────────────────────
app.get('/health', async () => ({
  status:    'ok',
  service:   'clutch-backend',
  timestamp: new Date().toISOString(),
}));

// ── Routes ────────────────────────────────────────────────────
await app.register(authRoutes,         { prefix: '/auth' });
await app.register(profileRoutes,      { prefix: '/profiles' });
await app.register(friendRoutes,       { prefix: '/friends' });
await app.register(presenceRoutes,     { prefix: '/presence' });
await app.register(integrationRoutes,  { prefix: '/integrations' });
await app.register(postRoutes,         { prefix: '/posts' });
await app.register(notificationRoutes, { prefix: '/notifications' });

// ── Start ─────────────────────────────────────────────────────
const start = async (): Promise<void> => {
  try {
    await app.listen({ port: 3333, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

void start();