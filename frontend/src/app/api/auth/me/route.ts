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
import { authSessionSchema } from '@/schemas/auth';
import { buildApiUrl } from '@/services/http/client';

async function fetchAuthenticatedSession(
  accessToken: string,
  requestId: string,
): Promise<Response> {
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

  logServerEvent('info', 'frontend_auth_me_start', 'Frontend auth session restore started', {
    requestId,
    method: request.method,
    path: request.nextUrl.pathname,
  });

  if (!token) {
    logServerEvent('warn', 'frontend_auth_me_missing_session', 'Frontend auth session cookie is missing', {
      requestId,
      status: 401,
      duration_ms: Date.now() - startedAt,
    });

    return NextResponse.json({ message: 'Sessao inexistente.' }, { status: 401 });
  }

  let backendResponse: Response;

  try {
    backendResponse = await fetchAuthenticatedSession(token, requestId);
  } catch (error) {
    logServerEvent('error', 'frontend_auth_me_backend_unreachable', 'Frontend auth session restore could not reach backend', {
      requestId,
      status: 502,
      duration_ms: Date.now() - startedAt,
      ...serializeServerError(error),
    });

    return NextResponse.json(
      { message: 'Nao foi possivel contatar o backend de autenticacao.' },
      { status: 502 },
    );
  }

  if (backendResponse.status === 401) {
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

      logServerEvent('warn', 'frontend_auth_me_refresh_rejected', 'Frontend auth session refresh was rejected', {
        requestId,
        status: refreshResult.status,
        duration_ms: Date.now() - startedAt,
      });

      return response;
    }

    try {
      backendResponse = await fetchAuthenticatedSession(refreshResult.accessToken, requestId);
    } catch (error) {
      logServerEvent('error', 'frontend_auth_me_backend_unreachable', 'Frontend auth session restore could not reach backend after refresh', {
        requestId,
        status: 502,
        duration_ms: Date.now() - startedAt,
        ...serializeServerError(error),
      });

      const response = NextResponse.json(
        { message: 'Nao foi possivel contatar o backend de autenticacao.' },
        { status: 502 },
      );

      setAccessSessionCookie(response, refreshResult.accessToken);
      appendRefreshSetCookie(response, refreshResult.refreshSetCookie);

      return response;
    }

    const payloadAfterRefresh = await backendResponse.json().catch(() => null);
    const parsedAfterRefresh = authSessionSchema.safeParse(payloadAfterRefresh);

    if (!backendResponse.ok || !parsedAfterRefresh.success) {
      const response = NextResponse.json(
        {
          message: backendResponse.ok
            ? 'Resposta invalida do backend de sessao.'
            : 'Falha ao restaurar a sessao.',
        },
        { status: backendResponse.ok ? 502 : backendResponse.status },
      );

      clearAccessSessionCookie(response);
      clearRefreshSessionCookie(response);
      appendRefreshSetCookie(response, refreshResult.refreshSetCookie);

      return response;
    }

    const response = NextResponse.json(parsedAfterRefresh.data, { status: 200 });
    setAccessSessionCookie(response, refreshResult.accessToken);
    appendRefreshSetCookie(response, refreshResult.refreshSetCookie);

    logServerEvent('info', 'frontend_auth_me_success', 'Frontend auth session restored after refresh', {
      requestId,
      status: 200,
      duration_ms: Date.now() - startedAt,
      username: parsedAfterRefresh.data.username,
    });

    return response;
  }

  const payload = await backendResponse.json().catch(() => null);

  if (!backendResponse.ok) {
    logServerEvent('warn', 'frontend_auth_me_rejected', 'Frontend auth session restore was rejected by backend', {
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
            : 'Falha ao restaurar a sessao.',
      },
      { status: backendResponse.status },
    );

    if (backendResponse.status === 401) {
      clearAccessSessionCookie(response);
    }

    return response;
  }

  const parsed = authSessionSchema.safeParse(payload);

  if (!parsed.success) {
    logServerEvent('error', 'frontend_auth_me_invalid_backend_payload', 'Frontend auth session restore received invalid backend payload', {
      requestId,
      status: 502,
      duration_ms: Date.now() - startedAt,
    });

    return NextResponse.json(
      { message: 'Resposta invalida do backend de sessao.' },
      { status: 502 },
    );
  }

  logServerEvent('info', 'frontend_auth_me_success', 'Frontend auth session restored', {
    requestId,
    status: 200,
    duration_ms: Date.now() - startedAt,
    username: parsed.data.username,
  });

  return NextResponse.json(parsed.data, { status: 200 });
}
