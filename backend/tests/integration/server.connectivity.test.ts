import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { AddressInfo } from 'node:net';
import { buildApp } from '../helpers/build-app';
import { DEMO_ACCOUNT, runSeed } from '../../prisma/seed';

const prisma = new PrismaClient();

let app: FastifyInstance | undefined;
let baseUrl: string;

describe('Server connectivity', () => {
  beforeAll(async () => {
    await prisma.$connect();
    await runSeed(prisma);

    app = await buildApp();
    await app.listen({ port: 0, host: '127.0.0.1' });

    const address = app.server.address();

    if (!address || typeof address === 'string') {
      throw new Error('Server connectivity test could not resolve a TCP address.');
    }

    baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  it('should respond on /health', async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
    });
  });

  it('should login with demo account', async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: DEMO_ACCOUNT.email,
        password: DEMO_ACCOUNT.password,
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      username: 'clutchplayer',
      message: 'Acesso autorizado.',
    });
  });
});
