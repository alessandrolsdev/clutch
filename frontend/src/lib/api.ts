import { useAuthStore } from '@/store/auth-store';

type JsonBody = Record<string, unknown>;

type ApiRequestInit = Omit<RequestInit, 'body'> & {
  body?: BodyInit | JsonBody;
};

function isJsonBody(value: ApiRequestInit['body']): value is JsonBody {
  return typeof value === 'object' && value !== null && !(value instanceof FormData);
}

export async function apiRequest(
  pathname: string,
  init: ApiRequestInit = {},
): Promise<Response> {
  const { body, headers, ...rest } = init;
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;

  const requestHeaders = new Headers(headers);
  let requestBody: BodyInit | undefined;

  if (isJsonBody(body)) {
    requestHeaders.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(body);
  } else {
    requestBody = body;
  }

  const response = await fetch(`/api${normalizedPath}`, {
    ...rest,
    credentials: 'include',
    headers: requestHeaders,
    body: requestBody,
  });

  if (response.status === 401) {
    useAuthStore.getState().clearSession();
  }

  return response;
}
