import { getClientEnv } from '@/lib/config/env';

export function buildApiUrl(pathname: string): string {
  const { apiUrl } = getClientEnv();

  if (!apiUrl) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured.');
  }

  return new URL(pathname, apiUrl).toString();
}
