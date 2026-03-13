import Fastify from 'fastify';

// ─────────────────────────────────────────────────────────────
// CLUTCH ⚡ — Entry point
// ─────────────────────────────────────────────────────────────

const app = Fastify({ logger: true });

app.get('/health', async () => ({
  status: 'ok',
  service: 'clutch-backend',
  timestamp: new Date().toISOString(),
}));

const start = async (): Promise<void> => {
  try {
    await app.listen({ port: 3333, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

void start();