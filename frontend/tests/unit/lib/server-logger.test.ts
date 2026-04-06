import { describe, expect, it } from 'vitest';
import {
  FRONTEND_SERVICE_NAME,
  createServerLogEntry,
  resolveServerRequestId,
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
});
