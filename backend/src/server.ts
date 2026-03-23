import Fastify from 'fastify';
import { authRoutes }         from '@/api/routes/auth.routes';
import { profileRoutes }      from '@/api/routes/profile.routes';
import { friendRoutes }       from '@/api/routes/friends.routes';
import { presenceRoutes }     from '@/api/routes/presence.routes';
import { integrationRoutes }  from '@/api/routes/integrations.routes';

// ─────────────────────────────────────────────────────────────
// CLUTCH ⚡ — Entry point
// ─────────────────────────────────────────────────────────────

const app = Fastify({ logger: true });

app.get('/health', async () => ({
  status:    'ok',
  service:   'clutch-backend',
  timestamp: new Date().toISOString(),
}));

await app.register(authRoutes,        { prefix: '/auth' });
await app.register(profileRoutes,     { prefix: '/profiles' });
await app.register(friendRoutes,      { prefix: '/friends' });
await app.register(presenceRoutes,    { prefix: '/presence' });
await app.register(integrationRoutes, { prefix: '/integrations' });

const start = async (): Promise<void> => {
  try {
    await app.listen({ port: 3333, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

void start();