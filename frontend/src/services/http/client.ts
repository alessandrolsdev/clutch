const DEFAULT_LOCAL_PUBLIC_APP_ORIGIN = 'http://localhost';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function normalizePathname(pathname: string): string {
  return pathname.replace(/^\/+/, '');
}

function isAbsoluteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'ws:' || url.protocol === 'wss:';
  } catch {
    return false;
  }
}

export function resolvePublicAppOrigin(): string {
  const explicitPublicOrigin =
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (explicitPublicOrigin) {
    return explicitPublicOrigin;
  }

  const publicApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (publicApiUrl && isAbsoluteUrl(publicApiUrl)) {
    return new URL(publicApiUrl).origin;
  }

  const publicWsUrl = process.env.NEXT_PUBLIC_WS_URL?.trim();

  if (publicWsUrl && isAbsoluteUrl(publicWsUrl)) {
    const wsOrigin = new URL(publicWsUrl);
    const httpProtocol = wsOrigin.protocol === 'wss:' ? 'https:' : 'http:';
    return `${httpProtocol}//${wsOrigin.host}`;
  }

  if (process.env.NODE_ENV !== 'production') {
    return DEFAULT_LOCAL_PUBLIC_APP_ORIGIN;
  }

  throw new Error('Public app origin is not configured.');
}

export function buildPublicAppUrl(pathname: string): string {
  return new URL(
    normalizePathname(pathname),
    normalizeBaseUrl(resolvePublicAppOrigin()),
  ).toString();
}

export function resolvePublicApiBaseUrl(): string {
  const publicApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (publicApiUrl) {
    if (isAbsoluteUrl(publicApiUrl)) {
      return publicApiUrl;
    }

    return new URL(normalizePathname(publicApiUrl), normalizeBaseUrl(resolvePublicAppOrigin())).toString();
  }

  return new URL('api/', normalizeBaseUrl(resolvePublicAppOrigin())).toString();
}

export function resolvePublicWsBaseUrl(): string {
  const explicitPublicWsUrl = process.env.NEXT_PUBLIC_WS_URL?.trim();

  if (explicitPublicWsUrl) {
    return explicitPublicWsUrl;
  }

  const publicOrigin = new URL(resolvePublicAppOrigin());
  const wsProtocol = publicOrigin.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${publicOrigin.host}`;
}

function resolveApiBaseUrl(): string {
  const internalApiUrl = process.env.INTERNAL_API_URL?.trim();

  if (internalApiUrl) {
    return internalApiUrl;
  }

  return resolvePublicApiBaseUrl();
}

export function buildApiUrl(pathname: string): string {
  const baseUrl = normalizeBaseUrl(resolveApiBaseUrl());
  const normalizedPath = normalizePathname(pathname);

  return new URL(normalizedPath, baseUrl).toString();
}
