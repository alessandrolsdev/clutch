const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

export const REFRESH_TOKEN_COOKIE_NAME = 'clutch_refresh';

type CookieOptions = {
  httpOnly: boolean;
  sameSite: 'Lax' | 'Strict' | 'None';
  secure: boolean;
  path: string;
  maxAge?: number;
  expires?: Date;
};

function resolveRefreshTokenTtlSeconds(): number {
  const rawValue = process.env['REFRESH_TOKEN_TTL_SECONDS'];
  const parsedValue = rawValue ? Number(rawValue) : Number.NaN;

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return Math.floor(parsedValue);
  }

  return DEFAULT_REFRESH_TOKEN_TTL_SECONDS;
}

function formatCookieDate(value: Date): string {
  return value.toUTCString();
}

function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path}`,
    options.httpOnly ? 'HttpOnly' : null,
    options.secure ? 'Secure' : null,
    `SameSite=${options.sameSite}`,
    typeof options.maxAge === 'number' ? `Max-Age=${options.maxAge}` : null,
    options.expires instanceof Date ? `Expires=${formatCookieDate(options.expires)}` : null,
  ].filter((attribute): attribute is string => Boolean(attribute));

  return attributes.join('; ');
}

export function parseCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (typeof cookieHeader !== 'string' || cookieHeader.trim().length === 0) {
    return null;
  }

  const cookies = cookieHeader.split(';');

  for (const rawCookie of cookies) {
    const [rawName, ...rawValueParts] = rawCookie.trim().split('=');

    if (rawName !== name || rawValueParts.length === 0) {
      continue;
    }

    const rawValue = rawValueParts.join('=');

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return null;
}

export function getRefreshTokenCookieMaxAgeSeconds(): number {
  return resolveRefreshTokenTtlSeconds();
}

export function serializeRefreshTokenCookie(token: string): string {
  return serializeCookie(REFRESH_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
    maxAge: getRefreshTokenCookieMaxAgeSeconds(),
  });
}

export function serializeClearedRefreshTokenCookie(): string {
  return serializeCookie(REFRESH_TOKEN_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
}
