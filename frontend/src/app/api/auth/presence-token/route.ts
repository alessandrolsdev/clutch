import { NextResponse, type NextRequest } from 'next/server';
import {
  AUTH_SESSION_COOKIE_NAME,
  getClearedAuthSessionCookieOptions,
} from '@/lib/auth/session';
import {
  logServerEvent,
  REQUEST_ID_HEADER,
  resolveServerRequestId,
  serializeServerError,
} from '@/lib/server/logger';
import { buildApiUrl } from '@/services/http/client';

export async function GET(request: NextRequest) {
  const requestId = resolveServerRequestId(request.headers.get(REQUEST_ID_HEADER));
  const startedAt = Date.now();
  const token = request.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value;

  logServerEvent('info', 'frontend_presence_token_start', 'Frontend presence token validation started', {
    requestId,
    method: request.method,
    path: request.nextUrl.pathname,
  });

  if (!token) {
    logServerEvent('warn', 'frontend_presence_token_missing_session', 'Frontend presence token request is missing session cookie', {
      requestId,
      status: 401,
      duration_ms: Date.now() - startedAt,
    });

    return NextResponse.json({ message: 'Sessao inexistente.' }, { status: 401 });
  }

  let backendResponse: Response;

  try {
    backendResponse = await fetch(buildApiUrl('/auth/me'), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        [REQUEST_ID_HEADER]: requestId,
      },
      cache: 'no-store',
    });
  } catch (error) {
    logServerEvent('error', 'frontend_presence_token_backend_unreachable', 'Frontend presence token validation could not reach backend', {
      requestId,
      status: 502,
      duration_ms: Date.now() - startedAt,
      ...serializeServerError(error),
    });

    return NextResponse.json(
      { message: 'Nao foi possivel validar a sessao de realtime.' },
      { status: 502 },
    );
  }

  if (!backendResponse.ok) {
    logServerEvent('warn', 'frontend_presence_token_rejected', 'Frontend presence token validation was rejected by backend', {
      requestId,
      backendStatus: backendResponse.status,
      status: backendResponse.status,
      duration_ms: Date.now() - startedAt,
    });

    const response = NextResponse.json(
      {
        message:
          backendResponse.status === 401
            ? 'Token invalido ou expirado.'
            : 'Nao foi possivel validar a sessao de realtime.',
      },
      { status: backendResponse.status },
    );

    if (backendResponse.status === 401) {
      response.cookies.set(
        AUTH_SESSION_COOKIE_NAME,
        '',
        getClearedAuthSessionCookieOptions(),
      );
    }

    return response;
  }

  const response = NextResponse.json({ token }, { status: 200 });
  response.headers.set('Cache-Control', 'no-store');

  logServerEvent('info', 'frontend_presence_token_success', 'Frontend presence token issued', {
    requestId,
    status: 200,
    duration_ms: Date.now() - startedAt,
  });

  return response;
}
