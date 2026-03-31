import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_SESSION_COOKIE_NAME, getClearedAuthSessionCookieOptions } from '@/lib/auth/session';

export async function POST(_request: NextRequest) {
  const response = NextResponse.json({ message: 'Sessão encerrada.' }, { status: 200 });

  response.cookies.set(
    AUTH_SESSION_COOKIE_NAME,
    '',
    getClearedAuthSessionCookieOptions(),
  );

  return response;
}
