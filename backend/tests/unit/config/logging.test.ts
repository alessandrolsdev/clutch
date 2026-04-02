import { describe, expect, it } from 'vitest';
import {
  BACKEND_SERVICE_NAME,
  REQUEST_ID_HEADER,
  createBackendRuntimeLogEntry,
  createFastifyLoggerOptions,
  resolveBackendRequestId,
  sanitizeConnectionUrl,
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
});
