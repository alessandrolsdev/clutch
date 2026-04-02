import { randomUUID } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import type { FastifyBaseLogger, FastifyServerOptions } from 'fastify';

export const BACKEND_SERVICE_NAME = 'backend';
export const REQUEST_ID_HEADER = 'x-request-id';

type RuntimeLogLevel = 'info' | 'warn' | 'error';

type RuntimeLogContext = Record<string, unknown>;

type RuntimeLogEntry = RuntimeLogContext & {
  level: RuntimeLogLevel;
  service: typeof BACKEND_SERVICE_NAME;
  timestamp: string;
  event: string;
  message: string;
};

function resolveHeaderValue(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim().length > 0) {
    return value[0].trim();
  }

  return null;
}

export function resolveBackendRequestId(headers: IncomingHttpHeaders): string {
  return resolveHeaderValue(headers[REQUEST_ID_HEADER]) ?? randomUUID();
}

export function createBackendRuntimeLogEntry(
  level: RuntimeLogLevel,
  event: string,
  message: string,
  context: RuntimeLogContext = {},
): RuntimeLogEntry {
  return {
    level,
    service: BACKEND_SERVICE_NAME,
    timestamp: new Date().toISOString(),
    event,
    message,
    ...context,
  };
}

export function writeBackendRuntimeLog(
  level: RuntimeLogLevel,
  event: string,
  message: string,
  context: RuntimeLogContext = {},
): void {
  const entry = createBackendRuntimeLogEntry(level, event, message, context);
  const serialized = `${JSON.stringify(entry)}\n`;

  if (level === 'error') {
    process.stderr.write(serialized);
    return;
  }

  process.stdout.write(serialized);
}

export function createFastifyLoggerOptions(): FastifyServerOptions['logger'] {
  return {
    level: process.env['LOG_LEVEL'] ?? 'info',
    base: {
      service: BACKEND_SERVICE_NAME,
    },
    messageKey: 'message',
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    formatters: {
      level(label): { level: string } {
        return { level: label };
      },
    },
  } satisfies FastifyServerOptions['logger'];
}

export function serializeErrorDetails(error: unknown): RuntimeLogContext {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
    };
  }

  return {
    errorMessage: String(error),
  };
}

export function logBackendError(
  logger: FastifyBaseLogger,
  event: string,
  message: string,
  error: unknown,
  context: RuntimeLogContext = {},
): void {
  logger.error(
    {
      event,
      ...serializeErrorDetails(error),
      ...context,
    },
    message,
  );
}
