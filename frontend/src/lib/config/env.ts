import { resolvePublicApiBaseUrl, resolvePublicWsBaseUrl } from '@/services/http/client';

type ClientEnv = {
  apiUrl: string;
  wsUrl: string;
};

export function getClientEnv(): ClientEnv {
  return {
    apiUrl: resolvePublicApiBaseUrl(),
    wsUrl: resolvePublicWsBaseUrl(),
  };
}
