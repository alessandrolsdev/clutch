import { randomUUID } from 'node:crypto';

export const FRONTEND_SERVICE_NAME = 'frontend';
export const REQUEST_ID_HEADER = 'x-request-id';

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

export function serializeServerError(error: unknown): LogContext {
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
