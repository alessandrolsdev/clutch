import { randomUUID } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import type { FastifyBaseLogger, FastifyServerOptions } from 'fastify';

export const BACKEND_SERVICE_NAME = 'backend';
export const REQUEST_ID_HEADER = 'x-request-id';
const SENSITIVE_URL_PATTERN = /[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s"'<>]+/g;

type RuntimeLogLevel = 'info' | 'warn' | 'error';

type RuntimeLogContext = Record<string, unknown>;

type SanitizedConnectionTarget = {
  scheme: string;
  host: string;
  port: string;
};

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

function parseConnectionTargetFallback(rawUrl: string): SanitizedConnectionTarget {
  const schemeSeparatorIndex = rawUrl.indexOf('://');
  if (schemeSeparatorIndex < 0) {
    return {
      scheme: '',
      host: '',
      port: '',
    };
  }

  const scheme = rawUrl.slice(0, schemeSeparatorIndex);
  const remainder = rawUrl.slice(schemeSeparatorIndex + 3);
  const atIndex = remainder.lastIndexOf('@');
  const hostAndPath = atIndex >= 0 ? remainder.slice(atIndex + 1) : remainder;
  const slashIndex = hostAndPath.indexOf('/');
  const hostPort = slashIndex >= 0 ? hostAndPath.slice(0, slashIndex) : hostAndPath;
  const colonIndex = hostPort.lastIndexOf(':');

  return {
    scheme,
    host: colonIndex >= 0 ? hostPort.slice(0, colonIndex) : hostPort,
    port: colonIndex >= 0 ? hostPort.slice(colonIndex + 1) : '',
  };
}

function formatSanitizedConnectionTarget(target: SanitizedConnectionTarget): string {
  const parts = [
    target.scheme ? `scheme=${target.scheme}` : null,
    target.host ? `host=${target.host}` : null,
    target.port ? `port=${target.port}` : null,
  ].filter((value): value is string => Boolean(value));

  if (parts.length === 0) {
    return '[connection redacted]';
  }

  return `[connection ${parts.join(' ')}]`;
}

export function sanitizeConnectionUrl(rawUrl: string): SanitizedConnectionTarget {
  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) {
    return {
      scheme: '',
      host: '',
      port: '',
    };
  }

  try {
    const parsedUrl = new URL(trimmedUrl);
    return {
      scheme: parsedUrl.protocol.replace(/:$/, ''),
      host: parsedUrl.hostname,
      port: parsedUrl.port,
    };
  } catch {
    return parseConnectionTargetFallback(trimmedUrl);
  }
}

export function sanitizeSensitiveText(value: string): string {
  if (!value.trim()) {
    return value;
  }

  return value.replace(SENSITIVE_URL_PATTERN, (match) => formatSanitizedConnectionTarget(sanitizeConnectionUrl(match)));
}

export function serializeErrorDetails(error: unknown): RuntimeLogContext {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: sanitizeSensitiveText(error.message),
      stack: error.stack ? sanitizeSensitiveText(error.stack) : undefined,
    };
  }

  return {
    errorMessage: sanitizeSensitiveText(String(error)),
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
