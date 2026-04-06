import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildApiUrl,
  resolvePublicApiBaseUrl,
  resolvePublicWsBaseUrl,
} from '@/services/http/client';

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
const originalInternalApiUrl = process.env.INTERNAL_API_URL;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const originalPublicAppUrl = process.env.PUBLIC_APP_URL;
const originalWsUrl = process.env.NEXT_PUBLIC_WS_URL;
const originalNodeEnv = process.env.NODE_ENV;
const mutableEnv = process.env as Record<string, string | undefined>;

describe('buildApiUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();

    if (typeof originalApiUrl === 'undefined') {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    }

    if (typeof originalInternalApiUrl === 'undefined') {
      delete process.env.INTERNAL_API_URL;
    } else {
      process.env.INTERNAL_API_URL = originalInternalApiUrl;
    }

    if (typeof originalAppUrl === 'undefined') {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    }

    if (typeof originalPublicAppUrl === 'undefined') {
      delete process.env.PUBLIC_APP_URL;
    } else {
      process.env.PUBLIC_APP_URL = originalPublicAppUrl;
    }

    if (typeof originalWsUrl === 'undefined') {
      delete process.env.NEXT_PUBLIC_WS_URL;
    } else {
      process.env.NEXT_PUBLIC_WS_URL = originalWsUrl;
    }

    if (typeof originalNodeEnv === 'undefined') {
      delete mutableEnv.NODE_ENV;
    } else {
      mutableEnv.NODE_ENV = originalNodeEnv;
    }
  });

  it('prefers the internal API URL on the server', () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    process.env.INTERNAL_API_URL = 'http://backend:3344';

    expect(buildApiUrl('/health')).toBe('http://backend:3344/health');
  });

  it('preserves the /api prefix when the public URL uses path routing', () => {
    delete process.env.INTERNAL_API_URL;
    process.env.NEXT_PUBLIC_API_URL = 'https://clutch.example/api';

    expect(buildApiUrl('/auth/login')).toBe('https://clutch.example/api/auth/login');
  });

  it('builds the public API URL from NEXT_PUBLIC_APP_URL when NEXT_PUBLIC_API_URL is relative', () => {
    delete process.env.INTERNAL_API_URL;
    process.env.NEXT_PUBLIC_APP_URL = 'https://preview.clutch.gg';
    process.env.NEXT_PUBLIC_API_URL = '/api';

    expect(resolvePublicApiBaseUrl()).toBe('https://preview.clutch.gg/api');
    expect(buildApiUrl('/auth/login')).toBe('https://preview.clutch.gg/api/auth/login');
  });

  it('prefers PUBLIC_APP_URL over NEXT_PUBLIC_APP_URL when both are configured', () => {
    delete process.env.INTERNAL_API_URL;
    process.env.PUBLIC_APP_URL = 'https://edge.clutch.gg';
    process.env.NEXT_PUBLIC_APP_URL = 'https://preview.clutch.gg';
    process.env.NEXT_PUBLIC_API_URL = '/api';

    expect(resolvePublicApiBaseUrl()).toBe('https://edge.clutch.gg/api');
  });

  it('falls back to localhost only outside production when no public origin is configured', () => {
    delete process.env.INTERNAL_API_URL;
    delete process.env.PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_WS_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    mutableEnv.NODE_ENV = 'development';

    expect(resolvePublicApiBaseUrl()).toBe('http://localhost/api/');
    expect(resolvePublicWsBaseUrl()).toBe('ws://localhost');
  });

  it('derives the websocket base URL from the configured public app origin', () => {
    delete process.env.NEXT_PUBLIC_WS_URL;
    process.env.NEXT_PUBLIC_APP_URL = 'https://preview.clutch.gg';

    expect(resolvePublicWsBaseUrl()).toBe('wss://preview.clutch.gg');
  });
});
