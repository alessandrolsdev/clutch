import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_SESSION_COOKIE_NAME, getClearedAuthSessionCookieOptions } from '@/lib/auth/session';
import { buildApiUrl } from '@/services/http/client';

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

async function proxyRequest(request: NextRequest, pathSegments: string[]) {
  const backendUrl = new URL(buildApiUrl(`/${pathSegments.join('/')}`));
  backendUrl.search = new URL(request.url).search;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('cookie');

  const sessionCookie = request.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value;

  if (sessionCookie) {
    headers.set('Authorization', `Bearer ${sessionCookie}`);
  }

  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.text();

  const backendResponse = await fetch(backendUrl, {
    method: request.method,
    headers,
    body: body && body.length > 0 ? body : undefined,
  });

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
