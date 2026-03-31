import { NextResponse, type NextRequest } from 'next/server';
import {
  AUTH_SESSION_COOKIE_NAME,
  getClearedAuthSessionCookieOptions,
} from '@/lib/auth/session';
import { buildApiUrl } from '@/services/http/client';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ message: 'Sessao inexistente.' }, { status: 401 });
  }

  let backendResponse: Response;

  try {
    backendResponse = await fetch(buildApiUrl('/auth/me'), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { message: 'Nao foi possivel validar a sessao de realtime.' },
      { status: 502 },
    );
  }

  if (!backendResponse.ok) {
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

  return response;
}
