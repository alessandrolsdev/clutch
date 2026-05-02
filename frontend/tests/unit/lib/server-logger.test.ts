import { describe, expect, it } from 'vitest';
import {
  FRONTEND_SERVICE_NAME,
  createServerLogEntry,
  resolveServerRequestId,
  sanitizeServerRequestPath,
  sanitizeServerSensitiveText,
  serializeServerError,
} from '@/lib/server/logger';

describe('server logger', () => {
  it('reutiliza o request id recebido no header', () => {
    expect(resolveServerRequestId('req-123')).toBe('req-123');
  });

  it('gera um request id quando o header nao existe', () => {
    const requestId = resolveServerRequestId(null);

    expect(typeof requestId).toBe('string');
    expect(requestId.length).toBeGreaterThan(0);
  });

  it('cria um log estruturado com campos obrigatorios', () => {
    const entry = createServerLogEntry('info', 'frontend_route_request', 'Frontend route request started', {
      route: '/api/auth/login',
    });

    expect(entry.level).toBe('info');
    expect(entry.service).toBe(FRONTEND_SERVICE_NAME);
    expect(entry.event).toBe('frontend_route_request');
    expect(entry.message).toBe('Frontend route request started');
    expect(entry.route).toBe('/api/auth/login');
    expect(typeof entry.timestamp).toBe('string');
  });

  it('sanitiza urls sensiveis em mensagens de erro', () => {
    const details = serializeServerError(new Error('dial redis://default:super-secret@redis.internal:6379 failed'));

    expect(sanitizeServerSensitiveText('redis://default:super-secret@redis.internal:6379')).toBe(
      '[connection scheme=redis host=redis.internal port=6379]',
    );
    expect(details.errorMessage).toBe('dial [connection scheme=redis host=redis.internal port=6379] failed');
    expect(String(details.stack)).not.toContain('super-secret');
    expect(String(details.stack)).not.toContain('redis://');
  });

  it('redige query sensivel em mensagens de erro', () => {
    const details = serializeServerError(
      new Error('callback failed /callback?code=oauth-code&state=oauth-state Authorization=Bearer abcdefghijklmnop'),
    );

    expect(details.errorMessage).toContain('?code=[REDACTED]');
    expect(details.errorMessage).toContain('&state=[REDACTED]');
    expect(details.errorMessage).toContain('Authorization=***');
    expect(details.errorMessage).not.toContain('oauth-code');
    expect(details.errorMessage).not.toContain('abcdefghijklmnop');
  });

  it('remove query sensivel de callbacks antes do log', () => {
    const sanitizedPath = sanitizeServerRequestPath(
      '/api/auth/social/google/callback?code=oauth-code&state=oauth-state&scope=profile',
    );

    expect(sanitizedPath).toBe('/api/auth/social/google/callback');
    expect(sanitizedPath).not.toContain('code=');
    expect(sanitizedPath).not.toContain('state=');
  });

  it('sanitiza paths e targets do contexto estruturado', () => {
    const entry = createServerLogEntry('info', 'frontend_route_request', 'Frontend route request started', {
      path: '/api/auth/accounts/myanimelist/link/callback?code=oauth-code&state=oauth-state',
      targetUrl: 'http://localhost/api/auth/accounts/steam/link/callback?openid.sig=signature&openid.return_to=http%3A%2F%2Flocalhost%2Fcallback',
      route: '/arena/challenges?page=2',
    });

    expect(entry.path).toBe('/api/auth/accounts/myanimelist/link/callback');
    expect(entry.targetUrl).toBe('/api/auth/accounts/steam/link/callback');
    expect(entry.route).toBe('/arena/challenges?page=2');
    expect(JSON.stringify(entry)).not.toContain('oauth-code');
    expect(JSON.stringify(entry)).not.toContain('openid.sig');
  });
});
