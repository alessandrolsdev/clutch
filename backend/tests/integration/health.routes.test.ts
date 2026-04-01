import { describe, expect, it } from 'vitest';
import { buildApp } from '../helpers/build-app';

describe('Health Routes', () => {
  it('retorna 200 em /health e /health/live', async () => {
    const app = await buildApp();

    const [healthResponse, liveResponse] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/health',
      }),
      app.inject({
        method: 'GET',
        url: '/health/live',
      }),
    ]);

    expect(healthResponse.statusCode).toBe(200);
    expect(healthResponse.json()).toEqual({ status: 'ok' });
    expect(liveResponse.statusCode).toBe(200);
    expect(liveResponse.json()).toEqual({ status: 'ok' });

    await app.close();
  });

  it('retorna 200 em /health/ready quando as dependências estão prontas', async () => {
    const app = await buildApp({
      readinessCheck: async () => ({
        status: 'ok',
        checks: {
          database: 'ok',
          redis: 'ok',
        },
      }),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/health/ready',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      checks: {
        database: 'ok',
        redis: 'ok',
      },
    });

    await app.close();
  });

  it('retorna 503 em /health/ready quando alguma dependência crítica falha', async () => {
    const app = await buildApp({
      readinessCheck: async () => ({
        status: 'error',
        checks: {
          database: 'error',
          redis: 'ok',
        },
      }),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/health/ready',
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: 'error',
      checks: {
        database: 'error',
        redis: 'ok',
      },
    });

    await app.close();
  });
});
