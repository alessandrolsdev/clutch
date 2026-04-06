import { randomUUID } from 'node:crypto';

export const FRONTEND_SERVICE_NAME = 'frontend';
export const REQUEST_ID_HEADER = 'x-request-id';
const SENSITIVE_URL_PATTERN = /[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s"'<>]+/g;

type LogLevel = 'info' | 'warn' | 'error';
type LogContext = Record<string, unknown>;

type LogEntry = LogContext & {
  level: LogLevel;
  service: typeof FRONTEND_SERVICE_NAME;
  timestamp: string;
  event: string;
  message: string;
};

function writeLog(level: LogLevel, entry: LogEntry): void {
  const serialized = `${JSON.stringify(entry)}\n`;

  if (level === 'error') {
    process.stderr.write(serialized);
    return;
  }

  process.stdout.write(serialized);
}

export function resolveServerRequestId(headerValue: string | null): string {
  if (typeof headerValue === 'string' && headerValue.trim().length > 0) {
    return headerValue.trim();
  }

  return randomUUID();
}

export function createServerLogEntry(
  level: LogLevel,
  event: string,
  message: string,
  context: LogContext = {},
): LogEntry {
  return {
    level,
    service: FRONTEND_SERVICE_NAME,
    timestamp: new Date().toISOString(),
    event,
    message,
    ...context,
  };
}

export function logServerEvent(
  level: LogLevel,
  event: string,
  message: string,
  context: LogContext = {},
): void {
  writeLog(level, createServerLogEntry(level, event, message, context));
}

function formatSanitizedConnectionTarget(rawUrl: string): string {
  const trimmedUrl = rawUrl.trim();

  if (!trimmedUrl) {
    return '[connection redacted]';
  }

  try {
    const parsedUrl = new URL(trimmedUrl);
    const parts = [
      parsedUrl.protocol ? `scheme=${parsedUrl.protocol.replace(/:$/, '')}` : null,
      parsedUrl.hostname ? `host=${parsedUrl.hostname}` : null,
      parsedUrl.port ? `port=${parsedUrl.port}` : null,
    ].filter((value): value is string => Boolean(value));

    return parts.length > 0 ? `[connection ${parts.join(' ')}]` : '[connection redacted]';
  } catch {
    return '[connection redacted]';
  }
}

export function sanitizeServerSensitiveText(value: string): string {
  if (!value.trim()) {
    return value;
  }

  return value.replace(SENSITIVE_URL_PATTERN, (match) => formatSanitizedConnectionTarget(match));
}

export function serializeServerError(error: unknown): LogContext {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: sanitizeServerSensitiveText(error.message),
      stack: error.stack ? sanitizeServerSensitiveText(error.stack) : undefined,
    };
  }

  return {
    errorMessage: sanitizeServerSensitiveText(String(error)),
  };
}
