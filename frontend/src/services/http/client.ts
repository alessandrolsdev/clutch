function resolveApiBaseUrl(): string {
  const internalApiUrl = process.env.INTERNAL_API_URL?.trim();

  if (internalApiUrl) {
    return internalApiUrl;
  }

  const publicApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (publicApiUrl) {
    return publicApiUrl;
  }

  throw new Error('API URL is not configured.');
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function normalizePathname(pathname: string): string {
  return pathname.replace(/^\/+/, '');
}

export function buildApiUrl(pathname: string): string {
  const baseUrl = normalizeBaseUrl(resolveApiBaseUrl());
  const normalizedPath = normalizePathname(pathname);

  return new URL(normalizedPath, baseUrl).toString();
}
