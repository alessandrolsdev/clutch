import { NextResponse, type NextRequest } from 'next/server';
import {
  REQUEST_ID_HEADER,
  resolveServerRequestId,
  serializeServerError,
  logServerEvent,
} from '@/lib/server/logger';
import { buildApiUrl, buildPublicAppUrl } from '@/services/http/client';

type RouteContext = {
  params: Promise<{
    provider: string;
  }>;
};

type StartSocialLoginResponse = {
  authorizationUrl?: string;
  message?: string;
};

async function readJsonBody(response: Response): Promise<StartSocialLoginResponse | null> {
  const text = await response.text();

  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as StartSocialLoginResponse;
  } catch {
    return null;
  }
}

function redirectToLoginWithError(message: string): NextResponse {
  const redirectUrl = new URL(buildPublicAppUrl('/login'));
  redirectUrl.searchParams.set('socialAuthError', message);
  return NextResponse.redirect(redirectUrl);
}

function parseAuthorizationUrl(value: string): URL | null {
  try {
    const parsedUrl = new URL(value);

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return null;
    }

    return parsedUrl;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { provider } = await context.params;
  const requestId = resolveServerRequestId(request.headers.get(REQUEST_ID_HEADER));

  let backendResponse: Response;

  try {
    backendResponse = await fetch(buildApiUrl(`/auth/social/${provider}/start`), {
      method: 'GET',
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
      cache: 'no-store',
    });
  } catch (error) {
    logServerEvent('error', 'frontend_auth_social_start_unreachable', 'Frontend social auth start could not reach backend', {
      requestId,
      provider,
      status: 502,
      ...serializeServerError(error),
    });

    return redirectToLoginWithError('Nao foi possivel iniciar o login social agora.');
  }

  const payload = await readJsonBody(backendResponse);

  if (!backendResponse.ok) {
    return redirectToLoginWithError(payload?.message ?? 'Nao foi possivel iniciar o login social agora.');
  }

  if (!payload?.authorizationUrl) {
    return redirectToLoginWithError('Resposta invalida do backend de login social.');
  }

  const authorizationUrl = parseAuthorizationUrl(payload.authorizationUrl);

  if (!authorizationUrl) {
    return redirectToLoginWithError('URL de autorizacao social invalida.');
  }

  return NextResponse.redirect(authorizationUrl);
}
