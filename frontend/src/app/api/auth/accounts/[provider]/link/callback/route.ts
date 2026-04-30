import { NextResponse, type NextRequest } from 'next/server';
import {
  REQUEST_ID_HEADER,
  resolveServerRequestId,
  serializeServerError,
  logServerEvent,
} from '@/lib/server/logger';
import { connectedAccountProviderSchema } from '@/schemas/integrations';
import { buildApiUrl, buildPublicAppUrl } from '@/services/http/client';

type RouteContext = {
  params: Promise<{
    provider: string;
  }>;
};

type ErrorResponse = {
  message?: string;
};

const SENSITIVE_ERROR_MESSAGE_PATTERN = /\b(?:code|state|token|access[_-]?token|refresh[_-]?token|secret|cookie|authorization)\b|bearer\s+/iu;

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function resolveMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const message = (payload as ErrorResponse).message;

    if (typeof message === 'string' && message.length > 0) {
      if (SENSITIVE_ERROR_MESSAGE_PATTERN.test(message)) {
        return fallback;
      }

      return message;
    }
  }

  return fallback;
}

function redirectToIntegrations(input: { status: 'success' | 'error'; message: string }): NextResponse {
  const redirectUrl = new URL(buildPublicAppUrl('/settings/integrations'));
  redirectUrl.searchParams.set('connectionStatus', input.status);
  redirectUrl.searchParams.set('connectionMessage', input.message);
  return NextResponse.redirect(redirectUrl);
}

function normalizeProvider(provider: string): string | null {
  const normalizedProvider = provider.trim().toUpperCase();
  const result = connectedAccountProviderSchema.safeParse(normalizedProvider);

  return result.success ? result.data.toLowerCase() : null;
}

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { provider } = await context.params;
  const normalizedProvider = normalizeProvider(provider);
  const requestId = resolveServerRequestId(request.headers.get(REQUEST_ID_HEADER));
  const callbackUrl = new URL(request.url);

  if (!normalizedProvider) {
    return redirectToIntegrations({
      status: 'error',
      message: 'Provider de conta não suportado.',
    });
  }

  const backendUrl = new URL(buildApiUrl(`/auth/accounts/${normalizedProvider}/link/callback`));
  backendUrl.search = callbackUrl.search;

  let backendResponse: Response;

  try {
    backendResponse = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
      cache: 'no-store',
    });
  } catch (error) {
    logServerEvent('error', 'frontend_account_link_callback_unreachable', 'Frontend account link callback could not reach backend', {
      requestId,
      provider,
      status: 502,
      ...serializeServerError(error),
    });

    return redirectToIntegrations({
      status: 'error',
      message: 'Nao foi possivel concluir a conexao agora.',
    });
  }

  const payload = await readJsonBody(backendResponse);

  if (!backendResponse.ok) {
    return redirectToIntegrations({
      status: 'error',
      message: resolveMessage(payload, 'Nao foi possivel concluir a conexao agora.'),
    });
  }

  return redirectToIntegrations({
    status: 'success',
    message: resolveMessage(payload, 'Conta conectada com sucesso.'),
  });
}
