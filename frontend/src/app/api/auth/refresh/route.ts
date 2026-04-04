import { NextResponse, type NextRequest } from 'next/server';
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
} from '@/lib/server/logger';

export async function POST(request: NextRequest) {
  const requestId = resolveServerRequestId(request.headers.get(REQUEST_ID_HEADER));
  const startedAt = Date.now();

  logServerEvent('info', 'frontend_auth_refresh_start', 'Frontend auth refresh started', {
    requestId,
    method: request.method,
    path: request.nextUrl.pathname,
  });

  const refreshResult = await refreshAuthSession(
    requestId,
    request.headers.get('cookie'),
  );

  if (!refreshResult.ok) {
    const response = NextResponse.json(
      {
        message:
          refreshResult.status === 401
            ? 'Sessao invalida ou expirada.'
            : 'Nao foi possivel renovar a sessao.',
      },
      { status: refreshResult.status },
    );

    clearAccessSessionCookie(response);
    clearRefreshSessionCookie(response);
    appendRefreshSetCookie(response, refreshResult.refreshSetCookie);

    logServerEvent('warn', 'frontend_auth_refresh_rejected', 'Frontend auth refresh failed', {
      requestId,
      status: refreshResult.status,
      duration_ms: Date.now() - startedAt,
    });

    return response;
  }

  const response = NextResponse.json({ message: 'Sessao renovada.' }, { status: 200 });

  setAccessSessionCookie(response, refreshResult.accessToken);
  appendRefreshSetCookie(response, refreshResult.refreshSetCookie);

  logServerEvent('info', 'frontend_auth_refresh_success', 'Frontend auth refresh completed', {
    requestId,
    status: 200,
    duration_ms: Date.now() - startedAt,
  });

  return response;
}
