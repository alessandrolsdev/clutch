import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_SESSION_COOKIE_NAME } from '@/lib/auth/session';
import {
  appendRefreshSetCookie,
  clearAccessSessionCookie,
  clearRefreshSessionCookie,
  refreshAuthSession,
  setAccessSessionCookie,
} from '@/lib/auth/backend-refresh';
import {
  logServerEvent,
  REQUEST_ID_HEADER,
  resolveServerRequestId,
  serializeServerError,
} from '@/lib/server/logger';
import { buildApiUrl } from '@/services/http/client';

async function validateAccessToken(accessToken: string, requestId: string): Promise<Response> {
  return fetch(buildApiUrl('/auth/me'), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      [REQUEST_ID_HEADER]: requestId,
    },
    cache: 'no-store',
  });
}

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
    backendResponse = await validateAccessToken(token, requestId);
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

  if (backendResponse.status === 401) {
    logServerEvent('info', 'frontend_auth_refresh_start', 'Frontend auth refresh started from presence token flow', {
      requestId,
      path: request.nextUrl.pathname,
      status: 401,
    });

    const refreshResult = await refreshAuthSession(
      requestId,
      request.headers.get('cookie'),
    );

    if (!refreshResult.ok) {
      const response = NextResponse.json(
        { message: 'Token invalido ou expirado.' },
        { status: refreshResult.status },
      );

      clearAccessSessionCookie(response);
      clearRefreshSessionCookie(response);
      appendRefreshSetCookie(response, refreshResult.refreshSetCookie);

      logServerEvent('warn', 'frontend_auth_refresh_failed', 'Frontend auth refresh failed during presence token flow', {
        requestId,
        status: refreshResult.status,
        duration_ms: Date.now() - startedAt,
      });
      logServerEvent('warn', 'frontend_auth_session_cleared', 'Frontend auth session cleared after presence token refresh failure', {
        requestId,
        status: refreshResult.status,
        reason: 'refresh_rejected',
        duration_ms: Date.now() - startedAt,
      });

      return response;
    }

    try {
      backendResponse = await validateAccessToken(refreshResult.accessToken, requestId);
    } catch (error) {
      logServerEvent('error', 'frontend_presence_token_backend_unreachable', 'Frontend presence token validation could not reach backend after refresh', {
        requestId,
        status: 502,
        duration_ms: Date.now() - startedAt,
        ...serializeServerError(error),
      });

      const response = NextResponse.json(
        { message: 'Nao foi possivel validar a sessao de realtime.' },
        { status: 502 },
      );

      setAccessSessionCookie(response, refreshResult.accessToken);
      appendRefreshSetCookie(response, refreshResult.refreshSetCookie);

      return response;
    }

    if (!backendResponse.ok) {
      const response = NextResponse.json(
        { message: 'Nao foi possivel validar a sessao de realtime.' },
        { status: backendResponse.status },
      );

      clearAccessSessionCookie(response);
      clearRefreshSessionCookie(response);
      appendRefreshSetCookie(response, refreshResult.refreshSetCookie);

      logServerEvent('warn', 'frontend_auth_session_cleared', 'Frontend auth session cleared after presence token validation failure', {
        requestId,
        status: backendResponse.status,
        reason: 'backend_rejected',
        duration_ms: Date.now() - startedAt,
      });

      return response;
    }

    const response = NextResponse.json({ token: refreshResult.accessToken }, { status: 200 });
    response.headers.set('Cache-Control', 'no-store');
    setAccessSessionCookie(response, refreshResult.accessToken);
    appendRefreshSetCookie(response, refreshResult.refreshSetCookie);

    logServerEvent('info', 'frontend_presence_token_success', 'Frontend presence token issued', {
      requestId,
      status: 200,
      duration_ms: Date.now() - startedAt,
    });

    return response;
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
      clearAccessSessionCookie(response);
      clearRefreshSessionCookie(response);
      logServerEvent('warn', 'frontend_auth_session_cleared', 'Frontend auth session cleared after presence token rejection', {
        requestId,
        status: 401,
        reason: 'backend_rejected',
        duration_ms: Date.now() - startedAt,
      });
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
