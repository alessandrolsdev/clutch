import { NextResponse, type NextRequest } from 'next/server';
import {
  appendRefreshSetCookie,
  clearAccessSessionCookie,
  clearRefreshSessionCookie,
} from '@/lib/auth/backend-refresh';
import { logServerEvent, REQUEST_ID_HEADER, resolveServerRequestId } from '@/lib/server/logger';
import { buildApiUrl } from '@/services/http/client';

export async function POST(request: NextRequest) {
  const requestId = resolveServerRequestId(request.headers.get(REQUEST_ID_HEADER));
  const startedAt = Date.now();
  let backendResponse: Response | null = null;

  try {
    backendResponse = await fetch(buildApiUrl('/auth/logout'), {
      method: 'POST',
      headers: {
        [REQUEST_ID_HEADER]: requestId,
        ...(request.headers.get('cookie')
          ? { cookie: request.headers.get('cookie') as string }
          : {}),
      },
      cache: 'no-store',
    });
  } catch {
    backendResponse = null;
  }

  const status = backendResponse && !backendResponse.ok ? backendResponse.status : 200;
  const response = NextResponse.json(
    {
      message:
        backendResponse && !backendResponse.ok
          ? 'Falha ao encerrar a sessao.'
          : 'Sessao encerrada.',
    },
    { status },
  );

  clearAccessSessionCookie(response);
  clearRefreshSessionCookie(response);
  appendRefreshSetCookie(response, backendResponse?.headers.get('set-cookie') ?? null);

  logServerEvent('info', 'frontend_auth_logout_completed', 'Frontend auth logout completed', {
    requestId,
    method: request.method,
    path: request.nextUrl.pathname,
    status,
    duration_ms: Date.now() - startedAt,
  });

  return response;
}
