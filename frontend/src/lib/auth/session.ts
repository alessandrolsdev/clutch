export const AUTH_SESSION_COOKIE_NAME = 'clutch_session';

export const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function getAuthSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
  };
}

export function getClearedAuthSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  };
}
