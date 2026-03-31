import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';
import { resolveServerPort } from './config/server-config';

const port = resolveServerPort(process.env['PORT']);
const host = '0.0.0.0';

function logUnhandledError(label: string, error: unknown): void {
  console.error(label, error);
}

process.on('uncaughtException', (error) => {
  logUnhandledError('Uncaught exception during backend runtime:', error);
});

process.on('unhandledRejection', (reason) => {
  logUnhandledError('Unhandled promise rejection during backend runtime:', reason);
});

const start = async (): Promise<void> => {
  let app: FastifyInstance | undefined;

  try {
    // eslint-disable-next-line no-console
    console.log('Server booting...');
    // eslint-disable-next-line no-console
    console.log('PORT:', process.env['PORT'] ?? port);

    app = await buildApp({ logger: true });
    await app.listen({ port, host });

    // eslint-disable-next-line no-console
    console.log('ADDRESS:', app.server.address());
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Stop the running API instance or set PORT to a different value.`);
    }

    if (app) {
      app.log.error(err);
    } else {
      console.error(err);
    }

    process.exit(1);
  }
};

void start();
