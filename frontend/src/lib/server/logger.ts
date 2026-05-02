import { randomUUID } from 'node:crypto';

export const FRONTEND_SERVICE_NAME = 'frontend';
export const REQUEST_ID_HEADER = 'x-request-id';
const SENSITIVE_URL_PATTERN = /[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s"'<>]+/g;
const LOG_URL_BASE = 'http://clutch.local';
const SENSITIVE_QUERY_PARAM_PATTERN =
  /^(?:code|state|token|access_token|refresh_token|id_token|authorization|client_secret|secret|openid\..*)$/iu;
const SENSITIVE_QUERY_VALUE_PATTERN =
  /(?<prefix>[?&](?:code|state|access_token|refresh_token|id_token|token|authorization|client_secret|secret|openid\.sig|openid\.return_to)=)(?!\*\*\*|\[REDACTED\])(?<value>[^\s"'&,}]+)/giu;
const AUTHORIZATION_VALUE_PATTERN =
  /(?<prefix>\bauthorization\b\s*[:=]\s*)(?<quote>"?)(?<value>[^",}]+)(?<suffix>"?)/giu;
const BEARER_TOKEN_PATTERN = /\bBearer\s+(?<token>[A-Za-z0-9._~+/=-]{8,})/gu;

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
    ...sanitizeLogContext(context),
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

  return value
    .replace(SENSITIVE_URL_PATTERN, (match) => formatSanitizedConnectionTarget(match))
    .replace(
      AUTHORIZATION_VALUE_PATTERN,
      (_match, prefix, quote, _value, suffix) => `${prefix}${quote}***${suffix}`,
    )
    .replace(BEARER_TOKEN_PATTERN, 'Bearer ***')
    .replace(
      SENSITIVE_QUERY_VALUE_PATTERN,
      (_match, prefix) => `${prefix}[REDACTED]`,
    );
}

export function sanitizeServerRequestPath(rawPath: string): string {
  const trimmedPath = rawPath.trim();

  if (!trimmedPath) {
    return rawPath;
  }

  try {
    const parsedUrl = new URL(trimmedPath, LOG_URL_BASE);
    const hasSensitiveQuery = Array.from(parsedUrl.searchParams.keys()).some((key) =>
      SENSITIVE_QUERY_PARAM_PATTERN.test(key),
    );

    return `${parsedUrl.pathname}${hasSensitiveQuery ? '' : parsedUrl.search}` || '/';
  } catch {
    const queryIndex = trimmedPath.indexOf('?');

    if (queryIndex < 0) {
      return sanitizeServerSensitiveText(trimmedPath);
    }

    const queryString = trimmedPath.slice(queryIndex + 1);
    const hasSensitiveQuery = queryString
      .split('&')
      .map((segment) => segment.split('=')[0] ?? '')
      .some((key) => SENSITIVE_QUERY_PARAM_PATTERN.test(decodeURIComponent(key.replace(/\+/gu, ' '))));

    return hasSensitiveQuery ? trimmedPath.slice(0, queryIndex) : sanitizeServerSensitiveText(trimmedPath);
  }
}

function shouldSanitizeAsPath(key: string): boolean {
  const normalizedKey = key.toLowerCase();

  return normalizedKey === 'path' ||
    normalizedKey === 'target' ||
    normalizedKey.endsWith('url') ||
    normalizedKey.endsWith('path');
}

function sanitizeLogContext(context: LogContext): LogContext {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => {
      if (typeof value !== 'string') {
        return [key, value];
      }

      return [
        key,
        shouldSanitizeAsPath(key)
          ? sanitizeServerRequestPath(value)
          : sanitizeServerSensitiveText(value),
      ];
    }),
  );
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
