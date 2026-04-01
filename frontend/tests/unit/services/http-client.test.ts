import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApiUrl } from '@/services/http/client';

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
const originalInternalApiUrl = process.env.INTERNAL_API_URL;

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
  });

  it('prefers the internal API URL on the server', () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    process.env.INTERNAL_API_URL = 'http://backend:3344';

    expect(buildApiUrl('/health')).toBe('http://backend:3344/health');
  });

  it('preserves the /api prefix when the public URL uses path routing', () => {
    delete process.env.INTERNAL_API_URL;
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost/api';

    expect(buildApiUrl('/auth/login')).toBe('http://localhost/api/auth/login');
  });
});
