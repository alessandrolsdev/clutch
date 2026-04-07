import { NextResponse, type NextRequest } from 'next/server';
import { isProtectedPath, isPublicEntryPath } from '@/lib/auth/routes';
import { AUTH_SESSION_COOKIE_NAME } from '@/lib/auth/session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value);

  if (hasSession && isPublicEntryPath(pathname)) {
    return NextResponse.redirect(new URL('/feed', request.url));
  }

  if (!hasSession && isProtectedPath(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/register',
    '/:username',
    '/:username/:path*',
    '/feed/:path*',
    '/notifications/:path*',
    '/settings/:path*',
  ],
};
