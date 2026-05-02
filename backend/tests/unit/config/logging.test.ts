import { describe, expect, it } from 'vitest';
import {
  BACKEND_SERVICE_NAME,
  REQUEST_ID_HEADER,
  createBackendRuntimeLogEntry,
  createFastifyLoggerOptions,
  resolveBackendRequestId,
  sanitizeConnectionUrl,
  sanitizeRequestPath,
  sanitizeSensitiveText,
  serializeErrorDetails,
} from '@/config/logging';

describe('logging config', () => {
  it('reaproveita o request id recebido no header', () => {
    const requestId = resolveBackendRequestId({
      [REQUEST_ID_HEADER]: 'req-123',
    });

    expect(requestId).toBe('req-123');
  });

  it('gera um request id quando o header nao existe', () => {
    const requestId = resolveBackendRequestId({});

    expect(typeof requestId).toBe('string');
    expect(requestId.length).toBeGreaterThan(0);
  });

  it('cria um log de runtime com campos obrigatorios', () => {
    const entry = createBackendRuntimeLogEntry('info', 'server_boot', 'Server booting', {
      port: 3344,
    });

    expect(entry.level).toBe('info');
    expect(entry.service).toBe(BACKEND_SERVICE_NAME);
    expect(entry.event).toBe('server_boot');
    expect(entry.message).toBe('Server booting');
    expect(entry.port).toBe(3344);
    expect(typeof entry.timestamp).toBe('string');
  });

  it('configura o logger do fastify com service e timestamp estruturados', () => {
    const loggerOptions = createFastifyLoggerOptions();

    expect(loggerOptions).toBeTruthy();
    expect(typeof loggerOptions).toBe('object');

    if (!loggerOptions || typeof loggerOptions !== 'object') {
      throw new Error('Logger options should be an object.');
    }

    expect(loggerOptions.base).toEqual({ service: BACKEND_SERVICE_NAME });
    expect(loggerOptions.messageKey).toBe('message');
    expect(typeof loggerOptions.timestamp).toBe('function');
  });

  it('mascara senha em url de conexao preservando host e porta', () => {
    const target = sanitizeConnectionUrl('redis://default:super-secret@redis.internal:6379/0');

    expect(target.scheme).toBe('redis');
    expect(target.host).toBe('redis.internal');
    expect(target.port).toBe('6379');
  });

  it('preserva url sem senha', () => {
    const target = sanitizeConnectionUrl('redis://redis.internal:6379/0');

    expect(target.host).toBe('redis.internal');
    expect(target.port).toBe('6379');
  });

  it('mascara senha em url invalida sem quebrar o parse', () => {
    const target = sanitizeConnectionUrl('redis://default:super-secret@%zz:6379');

    expect(target.host).toBe('%zz');
    expect(target.port).toBe('6379');
  });

  it('sanitiza urls sensiveis dentro de mensagens de erro', () => {
    const error = new Error('parse "redis://default:super-secret@%zz:6379": invalid URL escape "%zz"');

    const details = serializeErrorDetails(error);

    expect(sanitizeSensitiveText(error.message)).toBe(
      'parse "[connection scheme=redis host=%zz port=6379]": invalid URL escape "%zz"',
    );
    expect(details.errorMessage).toBe(
      'parse "[connection scheme=redis host=%zz port=6379]": invalid URL escape "%zz"',
    );
    expect(String(details.stack)).not.toContain('super-secret');
    expect(String(details.stack)).not.toContain('redis://');
  });

  it('redige tokens e query sensivel em mensagens de erro', () => {
    const details = serializeErrorDetails(
      new Error('callback failed /callback?code=oauth-code&state=oauth-state Authorization=Bearer abcdefghijklmnop'),
    );

    expect(details.errorMessage).toContain('?code=[REDACTED]');
    expect(details.errorMessage).toContain('&state=[REDACTED]');
    expect(details.errorMessage).toContain('Authorization=***');
    expect(details.errorMessage).not.toContain('oauth-code');
    expect(details.errorMessage).not.toContain('abcdefghijklmnop');
  });

  it('sanitiza paths sensiveis do contexto estruturado', () => {
    const entry = createBackendRuntimeLogEntry('info', 'request_start', 'Request started', {
      path: '/auth/social/google/callback?code=oauth-code&state=oauth-state',
      targetUrl: 'http://localhost/auth/accounts/steam/link/callback?openid.sig=signature',
    });

    expect(entry.path).toBe('/auth/social/google/callback');
    expect(entry.targetUrl).toBe('/auth/accounts/steam/link/callback');
    expect(JSON.stringify(entry)).not.toContain('oauth-code');
    expect(JSON.stringify(entry)).not.toContain('openid.sig');
  });

  it('remove query sensivel de paths de callback antes do log', () => {
    const path = sanitizeRequestPath(
      '/auth/social/google/callback?code=oauth-code&state=oauth-state&scope=profile',
    );

    expect(path).toBe('/auth/social/google/callback');
    expect(path).not.toContain('code=');
    expect(path).not.toContain('state=');
  });

  it('remove parametros OpenID sensiveis antes do log', () => {
    const path = sanitizeRequestPath(
      '/auth/accounts/steam/link/callback?openid.sig=signature&openid.return_to=http%3A%2F%2Flocalhost%2Fcallback%3Fstate%3Dsecret&openid.claimed_id=https%3A%2F%2Fsteamcommunity.com%2Fopenid%2Fid%2F76561198000000000',
    );

    expect(path).toBe('/auth/accounts/steam/link/callback');
    expect(path).not.toContain('openid.sig');
    expect(path).not.toContain('openid.return_to');
    expect(path).not.toContain('state=');
  });

  it('preserva query nao sensivel para observabilidade', () => {
    expect(sanitizeRequestPath('/arena/challenges?page=2')).toBe('/arena/challenges?page=2');
  });
});
