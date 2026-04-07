import axios from 'axios';
import {
  createIntegrationError,
  logIntegrationProviderEvent,
  translateUpstreamError,
} from '../integration.errors';

// ─────────────────────────────────────────────────────────────
// Epic Games Service — proxy para o Python service
// ─────────────────────────────────────────────────────────────

const EPIC_TIMEOUT = 30_000;
const EPIC_VALIDATE_TIMEOUT = 5_000;
const UNSUPPORTED_EPIC_ADAPTER_URLS = new Set([
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://python-service:8000',
]);

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function resolveEpicServiceUrl(): string {
  const configuredUrl = process.env['EPIC_SERVICE_URL']?.trim().replace(/^"(.*)"$/, '$1');

  if (!configuredUrl) {
    logIntegrationProviderEvent(
      'epic',
      'integration_epic_unavailable',
      'unsupported',
      'Epic adapter is not configured in the current runtime.',
    );

    throw createIntegrationError(
      'epic',
      503,
      'unsupported',
      'Integração Epic indisponível no runtime atual.',
    );
  }

  const normalizedUrl = normalizeBaseUrl(configuredUrl);

  if (UNSUPPORTED_EPIC_ADAPTER_URLS.has(normalizedUrl)) {
    logIntegrationProviderEvent(
      'epic',
      'integration_epic_unavailable',
      'unsupported',
      'Epic adapter URL points to an unsupported legacy runtime target.',
      { targetUrl: normalizedUrl },
    );

    throw createIntegrationError(
      'epic',
      503,
      'unsupported',
      'Integração Epic indisponível no runtime atual.',
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    logIntegrationProviderEvent(
      'epic',
      'integration_epic_unavailable',
      'misconfigured',
      'Epic adapter URL is invalid.',
    );

    throw createIntegrationError(
      'epic',
      503,
      'misconfigured',
      'Integração Epic indisponível no runtime atual.',
    );
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    logIntegrationProviderEvent(
      'epic',
      'integration_epic_unavailable',
      'misconfigured',
      'Epic adapter URL uses an unsupported scheme or embedded credentials.',
      { targetUrl: normalizedUrl },
    );

    throw createIntegrationError(
      'epic',
      503,
      'misconfigured',
      'Integração Epic indisponível no runtime atual.',
    );
  }

  return normalizedUrl;
}

export interface EpicGame {
  id:        string;
  title:     string;
  namespace: string;
  coverUrl:  string | null;
}

export const epicService = {

  async getLibrary(authToken: string): Promise<EpicGame[]> {
    const baseUrl = resolveEpicServiceUrl();

    try {
      const response = await axios.get<{ games: EpicGame[] }>(
        `${baseUrl}/library`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          timeout: EPIC_TIMEOUT,
        },
      );

      return response.data.games ?? [];
    } catch (error) {
      throw translateUpstreamError(
        'epic',
        error,
        'Integração Epic indisponível no momento.',
        { targetUrl: baseUrl },
      );
    }
  },

  async validateToken(authToken: string): Promise<boolean> {
    const baseUrl = resolveEpicServiceUrl();

    try {
      await axios.get(`${baseUrl}/validate`, {
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: EPIC_VALIDATE_TIMEOUT,
      });
      return true;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { status?: number } }).response?.status === 'number' &&
        [400, 401, 403].includes((error as { response?: { status?: number } }).response?.status as number)
      ) {
        return false;
      }

      throw translateUpstreamError(
        'epic',
        error,
        'Integração Epic indisponível no momento.',
        { targetUrl: baseUrl },
      );
    }
  },

  isConfigured(): boolean {
    try {
      resolveEpicServiceUrl();
      return true;
    } catch {
      return false;
    }
  },

};
