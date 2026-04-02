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
  redactedUrl: string;
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

function redactConnectionUrlFallback(rawUrl: string): string {
  const schemeSeparatorIndex = rawUrl.indexOf('://');
  if (schemeSeparatorIndex < 0) {
    return rawUrl;
  }

  const scheme = rawUrl.slice(0, schemeSeparatorIndex + 3);
  const remainder = rawUrl.slice(schemeSeparatorIndex + 3);
  const atIndex = remainder.lastIndexOf('@');
  if (atIndex < 0) {
    return rawUrl;
  }

  const userInfo = remainder.slice(0, atIndex);
  const hostAndPath = remainder.slice(atIndex + 1);
  const colonIndex = userInfo.indexOf(':');
  if (colonIndex < 0) {
    return rawUrl;
  }

  const username = userInfo.slice(0, colonIndex);
  return `${scheme}${username}:***@${hostAndPath}`;
}

export function sanitizeConnectionUrl(rawUrl: string): SanitizedConnectionTarget {
  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) {
    return {
      scheme: '',
      host: '',
      port: '',
      redactedUrl: '',
    };
  }

  try {
    const parsedUrl = new URL(trimmedUrl);
    const redactedUrl =
      parsedUrl.password.length > 0
        ? `${parsedUrl.protocol}//${parsedUrl.username}:***@${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`
        : parsedUrl.toString();

    return {
      scheme: parsedUrl.protocol.replace(/:$/, ''),
      host: parsedUrl.hostname,
      port: parsedUrl.port,
      redactedUrl,
    };
  } catch {
    return {
      scheme: '',
      host: '',
      port: '',
      redactedUrl: redactConnectionUrlFallback(trimmedUrl),
    };
  }
}

export function sanitizeSensitiveText(value: string): string {
  if (!value.trim()) {
    return value;
  }

  return value.replace(SENSITIVE_URL_PATTERN, (match) => sanitizeConnectionUrl(match).redactedUrl || match);
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
