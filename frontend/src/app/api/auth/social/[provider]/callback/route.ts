import { NextResponse, type NextRequest } from 'next/server';
import {
  appendRefreshSetCookie,
  setAccessSessionCookie,
} from '@/lib/auth/backend-refresh';
import {
  REQUEST_ID_HEADER,
  resolveServerRequestId,
  serializeServerError,
  logServerEvent,
} from '@/lib/server/logger';
import { loginBackendResponseSchema } from '@/schemas/auth';
import { buildApiUrl } from '@/services/http/client';

type RouteContext = {
  params: Promise<{
    provider: string;
  }>;
};

type ErrorResponse = {
  message?: string;
};

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
      return message;
    }
  }

  return fallback;
}

function redirectToLoginWithError(request: NextRequest, message: string): NextResponse {
  const redirectUrl = new URL('/login', request.url);
  redirectUrl.searchParams.set('socialAuthError', message);
  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { provider } = await context.params;
  const requestId = resolveServerRequestId(request.headers.get(REQUEST_ID_HEADER));
  const callbackUrl = new URL(request.url);
  const backendUrl = new URL(buildApiUrl(`/auth/social/${provider}/callback`));
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
    logServerEvent('error', 'frontend_auth_social_callback_unreachable', 'Frontend social auth callback could not reach backend', {
      requestId,
      provider,
      status: 502,
      ...serializeServerError(error),
    });

    return redirectToLoginWithError(
      request,
      'Nao foi possivel concluir o login social agora.',
    );
  }

  const payload = await readJsonBody(backendResponse);

  if (!backendResponse.ok) {
    return redirectToLoginWithError(
      request,
      resolveMessage(payload, 'Nao foi possivel concluir o login social agora.'),
    );
  }

  const sessionResult = loginBackendResponseSchema.safeParse(payload);

  if (!sessionResult.success) {
    return redirectToLoginWithError(
      request,
      'Resposta invalida do backend de login social.',
    );
  }

  const redirectUrl = new URL('/feed', request.url);
  const response = NextResponse.redirect(redirectUrl);

  setAccessSessionCookie(response, sessionResult.data.token);
  appendRefreshSetCookie(response, backendResponse.headers.get('set-cookie'));

  return response;
}
