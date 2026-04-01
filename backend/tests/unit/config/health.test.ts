import { describe, expect, it, vi } from 'vitest';
import { runReadinessChecks } from '../../../src/config/health';

describe('health config', () => {
  it('retorna ok quando banco e redis respondem', async () => {
    const readiness = await runReadinessChecks({
      checkDatabase: vi.fn().mockResolvedValue(undefined),
      checkRedis: vi.fn().mockResolvedValue('PONG'),
    });

    expect(readiness).toEqual({
      status: 'ok',
      checks: {
        database: 'ok',
        redis: 'ok',
      },
    });
  });

  it('marca database como error quando o ping do banco falha', async () => {
    const readiness = await runReadinessChecks({
      checkDatabase: vi.fn().mockRejectedValue(new Error('db offline')),
      checkRedis: vi.fn().mockResolvedValue('PONG'),
    });

    expect(readiness).toEqual({
      status: 'error',
      checks: {
        database: 'error',
        redis: 'ok',
      },
    });
  });

  it('marca redis como error quando o ping do redis falha', async () => {
    const readiness = await runReadinessChecks({
      checkDatabase: vi.fn().mockResolvedValue(undefined),
      checkRedis: vi.fn().mockRejectedValue(new Error('redis offline')),
    });

    expect(readiness).toEqual({
      status: 'error',
      checks: {
        database: 'ok',
        redis: 'error',
      },
    });
  });
});
