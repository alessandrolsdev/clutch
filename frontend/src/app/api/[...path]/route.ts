import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_SESSION_COOKIE_NAME, getClearedAuthSessionCookieOptions } from '@/lib/auth/session';
import {
  logServerEvent,
  REQUEST_ID_HEADER,
  resolveServerRequestId,
  serializeServerError,
} from '@/lib/server/logger';
import { buildApiUrl } from '@/services/http/client';

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

async function proxyRequest(request: NextRequest, pathSegments: string[]) {
  const requestId = resolveServerRequestId(request.headers.get(REQUEST_ID_HEADER));
  const startedAt = Date.now();
  const backendUrl = new URL(buildApiUrl(`/${pathSegments.join('/')}`));
  backendUrl.search = new URL(request.url).search;

  logServerEvent('info', 'frontend_api_proxy_start', 'Frontend API proxy request started', {
    requestId,
    method: request.method,
    path: request.nextUrl.pathname,
    target: backendUrl.pathname,
  });

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('cookie');
  headers.set(REQUEST_ID_HEADER, requestId);

  const sessionCookie = request.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value;

  if (sessionCookie) {
    headers.set('Authorization', `Bearer ${sessionCookie}`);
  }

  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.text();

  let backendResponse: Response;

  try {
    backendResponse = await fetch(backendUrl, {
      method: request.method,
      headers,
      body: body && body.length > 0 ? body : undefined,
    });
  } catch (error) {
    logServerEvent('error', 'frontend_api_proxy_backend_unreachable', 'Frontend API proxy could not reach backend', {
      requestId,
      target: backendUrl.pathname,
      status: 502,
      duration_ms: Date.now() - startedAt,
      ...serializeServerError(error),
    });

    return NextResponse.json(
      { message: 'Nao foi possivel contatar o backend.' },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers(backendResponse.headers);
  const responseBody = await backendResponse.text();
  const response = new NextResponse(responseBody || null, {
    status: backendResponse.status,
    headers: responseHeaders,
  });

  if (backendResponse.status === 401) {
    response.cookies.set(
      AUTH_SESSION_COOKIE_NAME,
      '',
      getClearedAuthSessionCookieOptions(),
    );
  }

  logServerEvent(
    backendResponse.ok ? 'info' : 'warn',
    'frontend_api_proxy_complete',
    'Frontend API proxy request completed',
    {
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      target: backendUrl.pathname,
      status: backendResponse.status,
      duration_ms: Date.now() - startedAt,
    },
  );

  return response;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}
