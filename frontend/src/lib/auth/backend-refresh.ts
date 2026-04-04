import { NextResponse } from 'next/server';
import {
  AUTH_SESSION_COOKIE_NAME,
  getAuthSessionCookieOptions,
  getClearedAuthSessionCookieOptions,
} from '@/lib/auth/session';
import {
  logServerEvent,
  REQUEST_ID_HEADER,
  serializeServerError,
} from '@/lib/server/logger';
import { refreshBackendResponseSchema } from '@/schemas/auth';
import { buildApiUrl } from '@/services/http/client';

export const REFRESH_SESSION_COOKIE_NAME = 'clutch_refresh';

type RefreshAuthSessionSuccess = {
  ok: true;
  accessToken: string;
  refreshSetCookie: string | null;
};

type RefreshAuthSessionFailure = {
  ok: false;
  status: number;
  refreshSetCookie: string | null;
  payload: unknown;
};

export type RefreshAuthSessionResult =
  | RefreshAuthSessionSuccess
  | RefreshAuthSessionFailure;

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function appendRefreshSetCookie(response: NextResponse, setCookie: string | null): void {
  if (typeof setCookie === 'string' && setCookie.length > 0) {
    response.headers.append('set-cookie', setCookie);
  }
}

export function setAccessSessionCookie(response: NextResponse, accessToken: string): void {
  response.cookies.set(
    AUTH_SESSION_COOKIE_NAME,
    accessToken,
    getAuthSessionCookieOptions(),
  );
}

export function clearAccessSessionCookie(response: NextResponse): void {
  response.cookies.set(
    AUTH_SESSION_COOKIE_NAME,
    '',
    getClearedAuthSessionCookieOptions(),
  );
}

export function clearRefreshSessionCookie(response: NextResponse): void {
  response.cookies.set(
    REFRESH_SESSION_COOKIE_NAME,
    '',
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: new Date(0),
      maxAge: 0,
    },
  );
}

export async function refreshAuthSession(
  requestId: string,
  cookieHeader: string | null,
): Promise<RefreshAuthSessionResult> {
  let backendResponse: Response;

  try {
    backendResponse = await fetch(buildApiUrl('/auth/refresh'), {
      method: 'POST',
      headers: {
        [REQUEST_ID_HEADER]: requestId,
        ...(typeof cookieHeader === 'string' && cookieHeader.length > 0
          ? { cookie: cookieHeader }
          : {}),
      },
      cache: 'no-store',
    });
  } catch (error) {
    logServerEvent('error', 'frontend_auth_refresh_backend_unreachable', 'Frontend auth refresh could not reach backend', {
      requestId,
      status: 502,
      ...serializeServerError(error),
    });

    return {
      ok: false,
      status: 502,
      refreshSetCookie: null,
      payload: {
        message: 'Nao foi possivel contatar o backend de autenticacao.',
      },
    };
  }

  const refreshSetCookie = backendResponse.headers.get('set-cookie');
  const payload = await readJsonBody(backendResponse);

  if (!backendResponse.ok) {
    return {
      ok: false,
      status: backendResponse.status,
      refreshSetCookie,
      payload,
    };
  }

  const parsedPayload = refreshBackendResponseSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return {
      ok: false,
      status: 502,
      refreshSetCookie,
      payload: {
        message: 'Resposta invalida do backend de autenticacao.',
      },
    };
  }

  return {
    ok: true,
    accessToken: parsedPayload.data.token,
    refreshSetCookie,
  };
}
