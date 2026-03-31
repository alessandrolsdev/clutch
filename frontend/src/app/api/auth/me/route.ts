import { NextResponse, type NextRequest } from 'next/server';
import { authSessionSchema } from '@/schemas/auth';
import { AUTH_SESSION_COOKIE_NAME, getClearedAuthSessionCookieOptions } from '@/lib/auth/session';
import { buildApiUrl } from '@/services/http/client';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ message: 'Sessão inexistente.' }, { status: 401 });
  }

  let backendResponse: Response;

  try {
    backendResponse = await fetch(buildApiUrl('/auth/me'), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    return NextResponse.json(
      { message: 'Não foi possível contatar o backend de autenticação.' },
      { status: 502 },
    );
  }

  const payload = await backendResponse.json().catch(() => null);

  if (!backendResponse.ok) {
    const response = NextResponse.json(
      {
        message:
          backendResponse.status === 401
            ? 'Token inválido ou expirado.'
            : 'Falha ao restaurar a sessão.',
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

  const parsed = authSessionSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Resposta inválida do backend de sessão.' },
      { status: 502 },
    );
  }

  return NextResponse.json(parsed.data, { status: 200 });
}
