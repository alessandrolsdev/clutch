import { useAuthStore } from '@/store/auth-store';

type JsonBody = Record<string, unknown>;

type ApiRequestInit = Omit<RequestInit, 'body'> & {
  body?: BodyInit | JsonBody;
  clearSessionOnUnauthorized?: boolean;
  retryOnUnauthorized?: boolean;
};

function isJsonBody(value: ApiRequestInit['body']): value is JsonBody {
  return typeof value === 'object' && value !== null && !(value instanceof FormData);
}

let refreshSessionPromise: Promise<boolean> | null = null;

async function refreshSessionSilently(): Promise<boolean> {
  if (!refreshSessionPromise) {
    refreshSessionPromise = fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshSessionPromise = null;
      });
  }

  return refreshSessionPromise;
}

export async function apiRequest(
  pathname: string,
  init: ApiRequestInit = {},
): Promise<Response> {
  const {
    body,
    clearSessionOnUnauthorized = true,
    retryOnUnauthorized = true,
    headers,
    ...rest
  } = init;
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;

  const requestHeaders = new Headers(headers);
  let requestBody: BodyInit | undefined;

  if (isJsonBody(body)) {
    requestHeaders.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(body);
  } else {
    requestBody = body;
  }

  async function executeRequest(): Promise<Response> {
    return fetch(`/api${normalizedPath}`, {
      ...rest,
      credentials: 'include',
      headers: requestHeaders,
      body: requestBody,
    });
  }

  let response = await executeRequest();
  const shouldAttemptRefresh =
    retryOnUnauthorized &&
    normalizedPath !== '/auth/refresh';

  if (response.status === 401 && shouldAttemptRefresh) {
    const refreshSucceeded = await refreshSessionSilently();

    if (refreshSucceeded) {
      response = await executeRequest();
    }
  }

  if (clearSessionOnUnauthorized && response.status === 401) {
    useAuthStore.getState().clearSession();
  }

  return response;
}
