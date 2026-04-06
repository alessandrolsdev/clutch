import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp, generateTestToken, TEST_JWT_SECRET } from '../../helpers/build-app';
import jwt from 'jsonwebtoken';
import { REFRESH_TOKEN_COOKIE_NAME } from '@/config/auth-session';

vi.mock('@/core/repositories/user.repository', () => ({
  userRepository: {
    existsByEmailOrUsername: vi.fn(),
    create:                  vi.fn(),
    findByEmail:             vi.fn(),
    findByUsername:          vi.fn(),
    findById:                vi.fn(),
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    hash:    vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn(),
  },
}));

import { userRepository } from '@/core/repositories/user.repository';
import bcrypt             from 'bcrypt';

const mockUser = {
  id:            'user-id-1',
  username:      'clutchplayer',
  email:         'player@clutch.gg',
  password_hash: 'hashed-password',
  isActive:      true,
  createdAt:     new Date(),
  updatedAt:     new Date(),
};

function extractCookieHeader(setCookieHeader: string | string[] | undefined): string {
  const rawHeader = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;

  if (typeof rawHeader !== 'string') {
    throw new Error('Set-Cookie ausente no response de teste.');
  }

  const [cookie] = rawHeader.split(';', 1);

  if (typeof cookie !== 'string' || cookie.length === 0) {
    throw new Error('Cookie invalido no response de teste.');
  }

  return cookie;
}

type JsonLogEntry = Record<string, unknown>;

function captureJsonLogs() {
  const entries: JsonLogEntry[] = [];

  const collect = (chunk: string | Uint8Array): boolean => {
    const serialized = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');

    for (const line of serialized.split('\n')) {
      const trimmed = line.trim();

      if (!trimmed.startsWith('{')) {
        continue;
      }

      try {
        entries.push(JSON.parse(trimmed) as JsonLogEntry);
      } catch {
        // Ignora linhas nao-JSON emitidas por bibliotecas.
      }
    }

    return true;
  };

  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => collect(chunk)) as typeof process.stdout.write);
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => collect(chunk)) as typeof process.stderr.write);

  return {
    entries,
    restore() {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    },
  };
}

describe('Auth Routes', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('POST /auth/register', () => {
    it('retorna 201 com token JWT', async () => {
      vi.mocked(userRepository.existsByEmailOrUsername).mockResolvedValue(false);
      vi.mocked(userRepository.create).mockResolvedValue(mockUser);

      const app      = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/auth/register',
        payload: { username: 'clutchplayer', email: 'player@clutch.gg', password: 'password123' },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toHaveProperty('token');
      expect(String(response.headers['set-cookie'])).toContain(REFRESH_TOKEN_COOKIE_NAME);
      await app.close();
    }, 10_000);

    it('retorna 409 quando usuário já existe', async () => {
      vi.mocked(userRepository.existsByEmailOrUsername).mockResolvedValue(true);

      const app      = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/auth/register',
        payload: { username: 'clutchplayer', email: 'player@clutch.gg', password: 'password123' },
      });

      expect(response.statusCode).toBe(409);
      await app.close();
    });

    it('retorna 400 com dados inválidos', async () => {
      const app      = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/auth/register',
        payload: { username: 'ab', email: 'invalid', password: '123' },
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });
  });

  describe('POST /auth/login', () => {
    it('retorna 200 com token JWT', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const app      = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/auth/login',
        payload: { email: 'player@clutch.gg', password: 'password123' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveProperty('token');
      expect(String(response.headers['set-cookie'])).toContain(REFRESH_TOKEN_COOKIE_NAME);
      await app.close();
    });

    it('retorna 401 com senha incorreta', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const app      = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/auth/login',
        payload: { email: 'player@clutch.gg', password: 'wrong' },
      });

      expect(response.statusCode).toBe(401);
      await app.close();
    });

    it('retorna 401 com email inexistente', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

      const app      = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/auth/login',
        payload: { email: 'naoexiste@clutch.gg', password: 'password123' },
      });

      expect(response.statusCode).toBe(401);
      await app.close();
    });

    it('emite logs estruturados de sucesso com requestId sem vazar token', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      const capturedLogs = captureJsonLogs();

      const app = await buildApp({ logger: true });
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'x-request-id': 'req-login-log-1' },
        payload: { email: 'player@clutch.gg', password: 'password123' },
      });

      capturedLogs.restore();

      expect(response.statusCode).toBe(200);
      const logEntry = capturedLogs.entries.find((entry) => entry.event === 'auth_login_succeeded');
      expect(logEntry).toMatchObject({
        event: 'auth_login_succeeded',
        requestId: 'req-login-log-1',
        status: 200,
        userId: 'user-id-1',
      });
      expect(JSON.stringify(capturedLogs.entries)).not.toContain('jwt-token');
      expect(JSON.stringify(capturedLogs.entries)).not.toContain('password123');
      await app.close();
    });

    it('emite logs estruturados de falha de login com requestId', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null);
      const capturedLogs = captureJsonLogs();

      const app = await buildApp({ logger: true });
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'x-request-id': 'req-login-log-2' },
        payload: { email: 'naoexiste@clutch.gg', password: 'password123' },
      });

      capturedLogs.restore();

      expect(response.statusCode).toBe(401);
      const logEntry = capturedLogs.entries.find((entry) => entry.event === 'auth_login_failed');
      expect(logEntry).toMatchObject({
        event: 'auth_login_failed',
        requestId: 'req-login-log-2',
        status: 401,
        reason: 'invalid_credentials',
      });
      expect(JSON.stringify(capturedLogs.entries)).not.toContain('password123');
      await app.close();
    });
  });

  describe('GET /auth/me', () => {
    it('retorna 200 com dados do usuário autenticado', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(mockUser);

      const app   = await buildApp();
      const token = generateTestToken(app);

      const response = await app.inject({
        method:  'GET',
        url:     '/auth/me',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ username: 'clutchplayer' });
      await app.close();
    });

    it('retorna 401 sem token', async () => {
      const app      = await buildApp();
      const response = await app.inject({ method: 'GET', url: '/auth/me' });

      expect(response.statusCode).toBe(401);
      await app.close();
    });

    it('retorna 401 com header Authorization malformado', async () => {
      const app   = await buildApp();
      const token = generateTestToken(app);

      const response = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { Authorization: `Bearer ${token} extra` },
      });

      expect(response.statusCode).toBe(401);
      await app.close();
    });

    it('retorna 401 com token expirado', async () => {
      const capturedLogs = captureJsonLogs();
      const app = await buildApp({ logger: true });
      const expiredToken = jwt.sign(
        {
          id: 'user-id-1',
          username: 'clutchplayer',
        },
        TEST_JWT_SECRET,
        {
          algorithm: 'HS256',
          expiresIn: -1,
        },
      );

      const response = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { Authorization: `Bearer ${expiredToken}` },
      });

      capturedLogs.restore();

      expect(response.statusCode).toBe(401);
      const logEntry = capturedLogs.entries.find((entry) => entry.event === 'auth_access_token_expired');
      expect(logEntry).toMatchObject({
        event: 'auth_access_token_expired',
        status: 401,
      });
      await app.close();
    });

    it('retorna 401 com token assinado com algoritmo diferente', async () => {
      const app = await buildApp();
      const token = jwt.sign(
        {
          id: 'user-id-1',
          username: 'clutchplayer',
        },
        TEST_JWT_SECRET,
        {
          algorithm: 'HS384',
          expiresIn: '7d',
        },
      );

      const response = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(401);
      await app.close();
    });

    it('retorna 401 no refresh quando o cookie de refresh esta ausente', async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
      });

      expect(response.statusCode).toBe(401);
      expect(String(response.headers['set-cookie'])).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=`);
      await app.close();
    });

    it('rotaciona o refresh token e rejeita reuse do token anterior', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(userRepository.findById).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const app = await buildApp();
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'player@clutch.gg', password: 'password123' },
      });

      const initialRefreshCookie = extractCookieHeader(loginResponse.headers['set-cookie']);

      const refreshResponse = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { cookie: initialRefreshCookie },
      });

      expect(refreshResponse.statusCode).toBe(200);
      expect(refreshResponse.json()).toHaveProperty('token');

      const rotatedRefreshCookie = extractCookieHeader(refreshResponse.headers['set-cookie']);
      expect(rotatedRefreshCookie).not.toBe(initialRefreshCookie);

      const meResponse = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: {
          Authorization: `Bearer ${refreshResponse.json().token as string}`,
        },
      });

      expect(meResponse.statusCode).toBe(200);

      const replayResponse = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { cookie: initialRefreshCookie },
      });

      expect(replayResponse.statusCode).toBe(401);
      await app.close();
    });

    it('logout invalida a sessao de refresh', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const app = await buildApp();
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'player@clutch.gg', password: 'password123' },
      });

      const refreshCookie = extractCookieHeader(loginResponse.headers['set-cookie']);

      const logoutResponse = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { cookie: refreshCookie },
      });

      expect(logoutResponse.statusCode).toBe(200);
      expect(String(logoutResponse.headers['set-cookie'])).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=`);

      const refreshAfterLogoutResponse = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { cookie: refreshCookie },
      });

      expect(refreshAfterLogoutResponse.statusCode).toBe(401);
      await app.close();
    });

    it('mantem logs estruturados para revogacao e rejeicao de refresh revogado', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      const capturedLogs = captureJsonLogs();

      const app = await buildApp({ logger: true });
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'x-request-id': 'req-login-log-3' },
        payload: { email: 'player@clutch.gg', password: 'password123' },
      });

      const refreshCookie = extractCookieHeader(loginResponse.headers['set-cookie']);

      const logoutResponse = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: {
          cookie: refreshCookie,
          'x-request-id': 'req-logout-log-1',
        },
      });

      const refreshAfterLogoutResponse = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: {
          cookie: refreshCookie,
          'x-request-id': 'req-refresh-log-1',
        },
      });

      capturedLogs.restore();

      expect(logoutResponse.statusCode).toBe(200);
      expect(refreshAfterLogoutResponse.statusCode).toBe(401);
      expect(capturedLogs.entries.find((entry) => entry.event === 'auth_session_revoked')).toMatchObject({
        event: 'auth_session_revoked',
        requestId: 'req-logout-log-1',
        status: 200,
        reason: 'logout',
      });
      expect(capturedLogs.entries.find((entry) => entry.event === 'auth_logout_completed')).toMatchObject({
        event: 'auth_logout_completed',
        requestId: 'req-logout-log-1',
        status: 200,
      });
      expect(capturedLogs.entries.find((entry) => entry.event === 'auth_refresh_rejected_revoked_session')).toMatchObject({
        event: 'auth_refresh_rejected_revoked_session',
        requestId: 'req-refresh-log-1',
        status: 401,
        reason: 'logout',
      });
      expect(JSON.stringify(capturedLogs.entries)).not.toContain('clutch_refresh=');
      await app.close();
    });
  });

});
