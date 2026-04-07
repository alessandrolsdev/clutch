import {
  sanitizeConnectionUrl,
  writeBackendRuntimeLog,
} from '../../config/logging';

export type IntegrationName = 'steam' | 'igdb' | 'epic';

export type IntegrationErrorReason =
  | 'invalid_request'
  | 'invalid_credentials'
  | 'not_found'
  | 'not_connected'
  | 'timeout'
  | 'upstream_unavailable'
  | 'unsupported'
  | 'misconfigured';

type AxiosErrorLike = {
  code?: string;
  message?: string;
  response?: {
    status?: number;
  };
};

function isAxiosErrorLike(error: unknown): error is AxiosErrorLike {
  return typeof error === 'object' && error !== null;
}

export class IntegrationError extends Error {
  readonly integration: IntegrationName;
  readonly statusCode: number;
  readonly reason: IntegrationErrorReason;
  readonly clientMessage: string;

  constructor(
    integration: IntegrationName,
    statusCode: number,
    reason: IntegrationErrorReason,
    clientMessage: string,
    message = clientMessage,
  ) {
    super(message);
    this.name = 'IntegrationError';
    this.integration = integration;
    this.statusCode = statusCode;
    this.reason = reason;
    this.clientMessage = clientMessage;
  }
}

export function createIntegrationError(
  integration: IntegrationName,
  statusCode: number,
  reason: IntegrationErrorReason,
  clientMessage: string,
  message = clientMessage,
): IntegrationError {
  return new IntegrationError(integration, statusCode, reason, clientMessage, message);
}

type UpstreamErrorOptions = {
  targetUrl?: string;
};

function buildSanitizedTargetContext(targetUrl?: string): Record<string, string> {
  if (!targetUrl) {
    return {};
  }

  const sanitizedTarget = sanitizeConnectionUrl(targetUrl);

  return {
    ...(sanitizedTarget.host ? { upstreamHost: sanitizedTarget.host } : {}),
    ...(sanitizedTarget.port ? { upstreamPort: sanitizedTarget.port } : {}),
    ...(sanitizedTarget.scheme ? { upstreamScheme: sanitizedTarget.scheme } : {}),
  };
}

export function logIntegrationProviderEvent(
  integration: IntegrationName,
  event: string,
  reason: IntegrationErrorReason,
  message: string,
  options: UpstreamErrorOptions = {},
): void {
  writeBackendRuntimeLog(
    'warn',
    event,
    message,
    {
      provider: integration,
      reason,
      ...buildSanitizedTargetContext(options.targetUrl),
    },
  );
}

export function translateUpstreamError(
  integration: IntegrationName,
  error: unknown,
  fallbackMessage: string,
  options: UpstreamErrorOptions = {},
): IntegrationError {
  if (error instanceof IntegrationError) {
    return error;
  }

  if (isAxiosErrorLike(error)) {
    if (error.code === 'ECONNABORTED') {
      logIntegrationProviderEvent(
        integration,
        `integration_${integration}_timeout`,
        'timeout',
        `${integration} upstream request timed out.`,
        options,
      );

      return createIntegrationError(
        integration,
        504,
        'timeout',
        fallbackMessage,
        `${integration} upstream request timed out.`,
      );
    }

    const responseStatus = error.response?.status;

    if (typeof responseStatus === 'number' && responseStatus >= 500) {
      logIntegrationProviderEvent(
        integration,
        `integration_${integration}_unavailable`,
        'upstream_unavailable',
        `${integration} upstream returned an unavailable status.`,
        options,
      );

      return createIntegrationError(
        integration,
        503,
        'upstream_unavailable',
        fallbackMessage,
        `${integration} upstream returned an unavailable status.`,
      );
    }
  }

  logIntegrationProviderEvent(
    integration,
    `integration_${integration}_unavailable`,
    'upstream_unavailable',
    `${integration} upstream request failed.`,
    options,
  );

  return createIntegrationError(
    integration,
    503,
    'upstream_unavailable',
    fallbackMessage,
    `${integration} upstream request failed.`,
  );
}
