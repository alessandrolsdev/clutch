import { buildApiUrl } from '@/services/http/client';

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

  const requestHeaders = new Headers(headers);
  let requestBody: BodyInit | undefined;

  if (isJsonBody(body)) {
    requestHeaders.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(body);
  } else {
    requestBody = body;
  }

  return fetch(buildApiUrl(pathname), {
    ...rest,
    headers: requestHeaders,
    body: requestBody,
  });
}
