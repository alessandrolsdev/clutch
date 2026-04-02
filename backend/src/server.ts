import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';
import {
  createBackendRuntimeLogEntry,
  logBackendError,
  serializeErrorDetails,
  writeBackendRuntimeLog,
} from './config/logging';
import { resolveServerPort } from './config/server-config';

const port = resolveServerPort(process.env['PORT']);
const host = '0.0.0.0';

function logUnhandledError(label: string, error: unknown): void {
  writeBackendRuntimeLog('error', 'backend_runtime_error', label, serializeErrorDetails(error));
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
    writeBackendRuntimeLog('info', 'server_boot', 'Server booting', {
      port: process.env['PORT'] ?? port,
      host,
    });

    app = await buildApp({ logger: true });
    await app.listen({ port, host });

    app.log.info(
      {
        event: 'server_listening',
        address: app.server.address(),
      },
      'Backend server listening',
    );
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'EADDRINUSE') {
      writeBackendRuntimeLog(
        'error',
        'server_port_in_use',
        `Port ${port} is already in use. Stop the running API instance or set PORT to a different value.`,
        { port },
      );
    }

    if (app) {
      logBackendError(app.log, 'server_startup_failed', 'Backend startup failed', err);
    } else {
      const entry = createBackendRuntimeLogEntry(
        'error',
        'server_startup_failed',
        'Backend startup failed',
        serializeErrorDetails(err),
      );
      process.stderr.write(`${JSON.stringify(entry)}\n`);
    }

    process.exit(1);
  }
};

void start();
