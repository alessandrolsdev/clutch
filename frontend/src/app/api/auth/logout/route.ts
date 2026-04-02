import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_SESSION_COOKIE_NAME, getClearedAuthSessionCookieOptions } from '@/lib/auth/session';
import { logServerEvent, REQUEST_ID_HEADER, resolveServerRequestId } from '@/lib/server/logger';

export async function POST(request: NextRequest) {
  const requestId = resolveServerRequestId(request.headers.get(REQUEST_ID_HEADER));
  const startedAt = Date.now();
  const response = NextResponse.json({ message: 'Sessao encerrada.' }, { status: 200 });

  response.cookies.set(
    AUTH_SESSION_COOKIE_NAME,
    '',
    getClearedAuthSessionCookieOptions(),
  );

  logServerEvent('info', 'frontend_auth_logout', 'Frontend auth logout completed', {
    requestId,
    method: request.method,
    path: request.nextUrl.pathname,
    status: 200,
    duration_ms: Date.now() - startedAt,
  });

  return response;
}
