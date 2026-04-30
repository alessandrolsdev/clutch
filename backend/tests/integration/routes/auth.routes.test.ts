import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp, generateTestToken, TEST_JWT_SECRET } from '../../helpers/build-app';
import jwt from 'jsonwebtoken';
import { REFRESH_TOKEN_COOKIE_NAME } from '@/config/auth-session';
import type { JwtKeyRotationConfig } from '@/config/jwt';

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

const jwtKeyRotationConfig: JwtKeyRotationConfig = {
  activeKid: 'v2',
  keys: {
    v1: 'clutch-legacy-secret',
    v2: TEST_JWT_SECRET,
  },
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

    it('bloqueia cadastro acima do limite com 429', async () => {
      vi.mocked(userRepository.existsByEmailOrUsername).mockResolvedValue(true);

      const app = await buildApp();

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await app.inject({
          method: 'POST',
          url: '/auth/register',
          payload: { username: `clutchplayer${attempt}`, email: `player${attempt}@clutch.gg`, password: 'password123' },
        });

        expect(response.statusCode).toBe(409);
      }

      const blockedResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { username: 'clutchplayer-overflow', email: 'overflow@clutch.gg', password: 'password123' },
      });

      expect(blockedResponse.statusCode).toBe(429);
      expect(blockedResponse.json()).toMatchObject({
        error: 'Too Many Requests',
        message: 'Muitas tentativas. Tente novamente em instantes.',
        statusCode: 429,
      });
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
      expect(jwt.decode(response.json().token as string, { complete: true })).toMatchObject({
        header: {
          kid: 'legacy',
        },
        payload: {
          iss: 'clutch.backend',
          aud: 'clutch.auth',
        },
      });
      expect(typeof (jwt.decode(response.json().token as string) as jwt.JwtPayload | null)?.nbf).toBe('number');
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

    it('bloqueia login acima do limite com 429 e log estruturado seguro', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null);
      const capturedLogs = captureJsonLogs();

      const app = await buildApp({ logger: true });

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await app.inject({
          method: 'POST',
          url: '/auth/login',
          headers: { 'x-request-id': `req-login-limit-${attempt}` },
          payload: { email: 'player@clutch.gg', password: 'wrong-password' },
        });

        expect(response.statusCode).toBe(401);
      }

      const blockedResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'x-request-id': 'req-login-limit-blocked' },
        payload: { email: 'player@clutch.gg', password: 'wrong-password' },
      });

      capturedLogs.restore();

      expect(blockedResponse.statusCode).toBe(429);
      expect(blockedResponse.json()).toMatchObject({
        error: 'Too Many Requests',
        message: 'Muitas tentativas. Tente novamente em instantes.',
        statusCode: 429,
      });
      const logEntry = capturedLogs.entries.find((entry) => entry.event === 'auth_rate_limit_exceeded');
      expect(logEntry).toMatchObject({
        event: 'auth_rate_limit_exceeded',
        requestId: 'req-login-limit-blocked',
        method: 'POST',
        path: '/auth/login',
        status: 429,
        limiter: 'login',
      });
      expect(JSON.stringify(logEntry)).not.toContain('wrong-password');
      expect(JSON.stringify(logEntry)).not.toContain('Authorization');
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
          issuer: 'clutch.backend',
          audience: 'clutch.auth',
          notBefore: 0,
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
          issuer: 'clutch.backend',
          audience: 'clutch.auth',
          notBefore: 0,
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

    it('aceita rota protegida com token assinado por chave valida configurada', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(mockUser);

      const app = await buildApp({ jwtKeyRotationConfig });
      const token = app.signAccessToken({
        id: 'user-id-1',
        username: 'clutchplayer',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      await app.close();
    });

    it('rejeita rota protegida com kid invalido', async () => {
      const app = await buildApp({ jwtKeyRotationConfig });
      const token = jwt.sign(
        {
          id: 'user-id-1',
          username: 'clutchplayer',
          tokenType: 'access',
        },
        'unknown-secret',
        {
          algorithm: 'HS256',
          expiresIn: '10m',
          header: {
            alg: 'HS256',
            kid: 'v999',
          },
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

    it('rejeita rota protegida com token assinado por chave nao reconhecida', async () => {
      const app = await buildApp({ jwtKeyRotationConfig });
      const token = jwt.sign(
        {
          id: 'user-id-1',
          username: 'clutchplayer',
          tokenType: 'access',
        },
        'wrong-key',
        {
          algorithm: 'HS256',
          expiresIn: '10m',
          issuer: 'clutch.backend',
          audience: 'clutch.auth',
          notBefore: 0,
          header: {
            alg: 'HS256',
            kid: 'v2',
          },
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

    it('rejeita rota protegida com issuer invalido', async () => {
      const app = await buildApp();
      const token = jwt.sign(
        {
          id: 'user-id-1',
          username: 'clutchplayer',
        },
        TEST_JWT_SECRET,
        {
          algorithm: 'HS256',
          expiresIn: '10m',
          issuer: 'external.backend',
          audience: 'clutch.auth',
          notBefore: 0,
          header: {
            alg: 'HS256',
            kid: 'legacy',
          },
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

    it('rejeita rota protegida com audience invalida', async () => {
      const app = await buildApp();
      const token = jwt.sign(
        {
          id: 'user-id-1',
          username: 'clutchplayer',
        },
        TEST_JWT_SECRET,
        {
          algorithm: 'HS256',
          expiresIn: '10m',
          issuer: 'clutch.backend',
          audience: 'external-client',
          notBefore: 0,
          header: {
            alg: 'HS256',
            kid: 'legacy',
          },
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

    it('rejeita rota protegida com nbf futuro', async () => {
      const app = await buildApp();
      const token = jwt.sign(
        {
          id: 'user-id-1',
          username: 'clutchplayer',
        },
        TEST_JWT_SECRET,
        {
          algorithm: 'HS256',
          expiresIn: '10m',
          issuer: 'clutch.backend',
          audience: 'clutch.auth',
          notBefore: '30s',
          header: {
            alg: 'HS256',
            kid: 'legacy',
          },
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

    it('bloqueia refresh acima do limite com 429', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const app = await buildApp();
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'player@clutch.gg', password: 'password123' },
      });

      const refreshCookie = extractCookieHeader(loginResponse.headers['set-cookie']);

      for (let attempt = 0; attempt < 20; attempt += 1) {
        const response = await app.inject({
          method: 'POST',
          url: '/auth/refresh',
          headers: { cookie: refreshCookie },
        });

        expect([200, 401]).toContain(response.statusCode);
      }

      const blockedResponse = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { cookie: refreshCookie },
      });

      expect(blockedResponse.statusCode).toBe(429);
      await app.close();
    });

    it('nao afeta rota fora do auth path apos exceder o limite de login', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

      const app = await buildApp();

      for (let attempt = 0; attempt < 6; attempt += 1) {
        await app.inject({
          method: 'POST',
          url: '/auth/login',
          payload: { email: 'player@clutch.gg', password: 'wrong-password' },
        });
      }

      const healthResponse = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(healthResponse.statusCode).toBe(200);
      expect(healthResponse.json()).toMatchObject({ status: 'ok' });
      await app.close();
    });
  });

  describe('GET /auth/social/:provider', () => {
    it('inicia login social para provider suportado', async () => {
      const socialAuthService = {
        startLogin: vi.fn().mockResolvedValue({
          provider: 'GOOGLE',
          authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=signed-state',
        }),
        completeCallback: vi.fn(),
      };
      const app = await buildApp({ socialAuthService });

      const response = await app.inject({
        method: 'GET',
        url: '/auth/social/google/start',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        provider: 'GOOGLE',
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=signed-state',
      });
      expect(socialAuthService.startLogin).toHaveBeenCalledWith('google');
      await app.close();
    });

    it('retorna erro coerente para provider social nao suportado', async () => {
      const socialAuthService = {
        startLogin: vi.fn().mockRejectedValue({
          name: 'SocialAuthError',
          statusCode: 400,
          reason: 'unsupported_provider',
          clientMessage: 'Provider social não suportado.',
        }),
        completeCallback: vi.fn(),
      };
      const app = await buildApp({ socialAuthService });

      const response = await app.inject({
        method: 'GET',
        url: '/auth/social/steam/start',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        message: 'Provider social não suportado.',
      });
      await app.close();
    });

    it('conclui callback social e emite refresh cookie da sessao CLUTCH', async () => {
      const socialAuthService = {
        startLogin: vi.fn(),
        completeCallback: vi.fn().mockResolvedValue({
          provider: 'DISCORD',
          user: {
            id: 'user-id-1',
            username: 'clutchplayer',
          },
          isNewUser: false,
        }),
      };
      const app = await buildApp({ socialAuthService });

      const response = await app.inject({
        method: 'GET',
        url: '/auth/social/discord/callback?code=oauth-code&state=signed-state',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        id: 'user-id-1',
        username: 'clutchplayer',
        message: 'Acesso autorizado.',
      });
      expect(response.json()).toHaveProperty('token');
      expect(String(response.headers['set-cookie'])).toContain(REFRESH_TOKEN_COOKIE_NAME);
      expect(socialAuthService.completeCallback).toHaveBeenCalledWith({
        provider: 'discord',
        code: 'oauth-code',
        state: 'signed-state',
        providerError: undefined,
        requestId: expect.any(String),
      });
      await app.close();
    });

    it('retorna erro coerente para callback com state invalido', async () => {
      const socialAuthService = {
        startLogin: vi.fn(),
        completeCallback: vi.fn().mockRejectedValue({
          name: 'SocialAuthError',
          statusCode: 400,
          reason: 'invalid_state',
          clientMessage: 'Callback social inválido.',
        }),
      };
      const app = await buildApp({ socialAuthService });

      const response = await app.inject({
        method: 'GET',
        url: '/auth/social/google/callback?code=oauth-code&state=invalid-state',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        message: 'Callback social inválido.',
      });
      await app.close();
    });
  });

  describe('account connection routes', () => {
    function createAccountConnectionService() {
      return {
        listConnectedAccounts: vi.fn().mockResolvedValue({ accounts: [] }),
        startLink: vi.fn().mockResolvedValue({
          provider: 'GOOGLE',
          authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=signed-state',
        }),
        completeLink: vi.fn().mockResolvedValue({
          provider: 'GOOGLE',
          externalId: 'google-external-id',
          status: 'CONNECTED',
          connectionType: 'SOCIAL_LOGIN',
          message: 'Google vinculado com sucesso.',
        }),
        unlink: vi.fn().mockResolvedValue({
          provider: 'GOOGLE',
          message: 'Google desconectado com sucesso.',
        }),
        updateVisibility: vi.fn().mockResolvedValue({
          provider: 'GOOGLE',
          displayName: 'Google',
          externalId: 'google-external-id',
          connectionType: 'SOCIAL_LOGIN',
          status: 'CONNECTED',
          dataSource: 'OFFICIAL',
          publicProfileVisible: true,
          connected: true,
          needsReauth: false,
          experimental: false,
          canUnlink: true,
          capabilities: ['SOCIAL_LOGIN', 'OAUTH_CONNECT'],
          lastSyncAt: null,
          createdAt: '2026-04-28T00:00:00.000Z',
          updatedAt: '2026-04-28T00:00:00.000Z',
        }),
        startReauth: vi.fn().mockResolvedValue({
          provider: 'DISCORD',
          authorizationUrl: 'https://discord.com/oauth2/authorize?state=signed-state',
        }),
        completeReauth: vi.fn().mockResolvedValue({
          provider: 'DISCORD',
          externalId: 'discord-external-id',
          status: 'CONNECTED',
          connectionType: 'CONNECTED_ACCOUNT',
          message: 'Discord reconectado com sucesso.',
        }),
      };
    }

    it('lista contas conectadas do usuario autenticado sem tokens', async () => {
      const accountConnectionService = createAccountConnectionService();
      accountConnectionService.listConnectedAccounts.mockResolvedValue({
        accounts: [
          {
            provider: 'DISCORD',
            displayName: 'Discord',
            externalId: 'discord-external-id',
            connectionType: 'CONNECTED_ACCOUNT',
            status: 'CONNECTED',
            dataSource: 'OFFICIAL',
            publicProfileVisible: false,
            connected: true,
            needsReauth: false,
            experimental: false,
            canUnlink: true,
            capabilities: ['SOCIAL_LOGIN', 'CONNECTED_ACCOUNT', 'OAUTH_CONNECT'],
            lastSyncAt: null,
            createdAt: '2026-04-28T00:00:00.000Z',
            updatedAt: '2026-04-28T00:00:00.000Z',
          },
        ],
      });
      const app = await buildApp({ accountConnectionService });
      const token = generateTestToken(app);

      const response = await app.inject({
        method: 'GET',
        url: '/auth/connected-accounts',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        accounts: [
          {
            provider: 'DISCORD',
            externalId: 'discord-external-id',
            connected: true,
          },
        ],
      });
      expect(JSON.stringify(response.json())).not.toContain('accessToken');
      expect(accountConnectionService.listConnectedAccounts).toHaveBeenCalledWith('user-id-1');
      await app.close();
    });

    it('exige autenticacao para listar contas conectadas', async () => {
      const accountConnectionService = createAccountConnectionService();
      const app = await buildApp({ accountConnectionService });

      const response = await app.inject({
        method: 'GET',
        url: '/auth/connected-accounts',
      });

      expect(response.statusCode).toBe(401);
      expect(accountConnectionService.listConnectedAccounts).not.toHaveBeenCalled();
      await app.close();
    });

    it('inicia linking autenticado para provider suportado', async () => {
      const accountConnectionService = createAccountConnectionService();
      const app = await buildApp({ accountConnectionService });
      const token = generateTestToken(app);

      const response = await app.inject({
        method: 'GET',
        url: '/auth/accounts/google/link/start',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        provider: 'GOOGLE',
        authorizationUrl: expect.stringContaining('state=signed-state'),
      });
      expect(accountConnectionService.startLink).toHaveBeenCalledWith({
        userId: 'user-id-1',
        provider: 'google',
      });
      await app.close();
    });

    it('inicia linking MyAnimeList autenticado usando rota generica de contas', async () => {
      const accountConnectionService = createAccountConnectionService();
      accountConnectionService.startLink.mockResolvedValueOnce({
        provider: 'MYANIMELIST',
        authorizationUrl: 'https://myanimelist.net/v1/oauth2/authorize?state=signed-state',
      });
      const app = await buildApp({ accountConnectionService });
      const token = generateTestToken(app);

      const response = await app.inject({
        method: 'GET',
        url: '/auth/accounts/myanimelist/link/start',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        provider: 'MYANIMELIST',
        authorizationUrl: expect.stringContaining('myanimelist.net/v1/oauth2/authorize'),
      });
      expect(accountConnectionService.startLink).toHaveBeenCalledWith({
        userId: 'user-id-1',
        provider: 'myanimelist',
      });
      await app.close();
    });

    it('bloqueia start de linking sem autenticacao', async () => {
      const accountConnectionService = createAccountConnectionService();
      const app = await buildApp({ accountConnectionService });

      const response = await app.inject({
        method: 'GET',
        url: '/auth/accounts/google/link/start',
      });

      expect(response.statusCode).toBe(401);
      expect(accountConnectionService.startLink).not.toHaveBeenCalled();
      await app.close();
    });

    it('retorna conflito de dominio no start de linking', async () => {
      const accountConnectionService = createAccountConnectionService();
      accountConnectionService.startLink.mockRejectedValue({
        name: 'AccountConnectionError',
        statusCode: 400,
        reason: 'unsupported_provider',
        clientMessage: 'Provider nao suporta conexao OpenID neste momento.',
      });
      const app = await buildApp({ accountConnectionService });
      const token = generateTestToken(app);

      const response = await app.inject({
        method: 'GET',
        url: '/auth/accounts/steam/link/start',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        message: 'Provider nao suporta conexao OpenID neste momento.',
      });
      await app.close();
    });

    it('conclui callback de linking sem emitir sessao nova', async () => {
      const accountConnectionService = createAccountConnectionService();
      const app = await buildApp({ accountConnectionService });

      const response = await app.inject({
        method: 'GET',
        url: '/auth/accounts/google/link/callback?code=oauth-code&state=signed-state',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        provider: 'GOOGLE',
        externalId: 'google-external-id',
        status: 'CONNECTED',
        connectionType: 'SOCIAL_LOGIN',
      });
      expect(response.json()).not.toHaveProperty('token');
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(accountConnectionService.completeLink).toHaveBeenCalledWith({
        provider: 'google',
        code: 'oauth-code',
        state: 'signed-state',
        providerError: undefined,
        openIdParams: expect.objectContaining({
          code: 'oauth-code',
          state: 'signed-state',
        }),
      });
      await app.close();
    });

    it('conclui callback Steam OpenID repassando parametros sem emitir sessao nova', async () => {
      const accountConnectionService = createAccountConnectionService();
      accountConnectionService.completeLink.mockResolvedValueOnce({
        provider: 'STEAM',
        externalId: '76561198000000000',
        status: 'CONNECTED',
        connectionType: 'CONNECTED_ACCOUNT',
        message: 'Steam verificada e conectada com sucesso.',
      });
      const app = await buildApp({ accountConnectionService });

      const response = await app.inject({
        method: 'GET',
        url: '/auth/accounts/steam/link/callback?state=signed-state&openid.mode=id_res&openid.claimed_id=https%3A%2F%2Fsteamcommunity.com%2Fopenid%2Fid%2F76561198000000000',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        provider: 'STEAM',
        externalId: '76561198000000000',
        status: 'CONNECTED',
        connectionType: 'CONNECTED_ACCOUNT',
      });
      expect(response.json()).not.toHaveProperty('token');
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(accountConnectionService.completeLink).toHaveBeenCalledWith({
        provider: 'steam',
        code: undefined,
        state: 'signed-state',
        providerError: undefined,
        openIdParams: expect.objectContaining({
          'openid.mode': 'id_res',
          'openid.claimed_id': 'https://steamcommunity.com/openid/id/76561198000000000',
        }),
      });
      await app.close();
    });

    it('retorna erro coerente no callback de linking com identity conflict', async () => {
      const accountConnectionService = createAccountConnectionService();
      accountConnectionService.completeLink.mockRejectedValue({
        name: 'AccountConnectionError',
        statusCode: 409,
        reason: 'identity_conflict',
        clientMessage: 'Esta identidade externa já está vinculada a outro usuário.',
      });
      const app = await buildApp({ accountConnectionService });

      const response = await app.inject({
        method: 'GET',
        url: '/auth/accounts/discord/link/callback?code=oauth-code&state=signed-state',
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        message: 'Esta identidade externa já está vinculada a outro usuário.',
      });
      await app.close();
    });

    it('desconecta conta externa autenticada', async () => {
      const accountConnectionService = createAccountConnectionService();
      const app = await buildApp({ accountConnectionService });
      const token = generateTestToken(app);

      const response = await app.inject({
        method: 'DELETE',
        url: '/auth/accounts/google',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        provider: 'GOOGLE',
        message: 'Google desconectado com sucesso.',
      });
      expect(accountConnectionService.unlink).toHaveBeenCalledWith({
        userId: 'user-id-1',
        provider: 'google',
      });
      await app.close();
    });

    it('bloqueia unlink inseguro com erro de dominio', async () => {
      const accountConnectionService = createAccountConnectionService();
      accountConnectionService.unlink.mockRejectedValue({
        name: 'AccountConnectionError',
        statusCode: 409,
        reason: 'unsafe_unlink',
        clientMessage: 'Não é possível remover o último método de login da conta.',
      });
      const app = await buildApp({ accountConnectionService });
      const token = generateTestToken(app);

      const response = await app.inject({
        method: 'DELETE',
        url: '/auth/accounts/google',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        message: 'Não é possível remover o último método de login da conta.',
      });
      await app.close();
    });

    it('atualiza visibilidade de conta conectada autenticada', async () => {
      const accountConnectionService = createAccountConnectionService();
      const app = await buildApp({ accountConnectionService });
      const token = generateTestToken(app);

      const response = await app.inject({
        method: 'PATCH',
        url: '/auth/connected-accounts/google/visibility',
        headers: { Authorization: `Bearer ${token}` },
        payload: { publicProfileVisible: true },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        provider: 'GOOGLE',
        publicProfileVisible: true,
      });
      expect(accountConnectionService.updateVisibility).toHaveBeenCalledWith({
        userId: 'user-id-1',
        provider: 'google',
        publicProfileVisible: true,
      });
      await app.close();
    });

    it('inicia linking Steam OpenID autenticado', async () => {
      const accountConnectionService = createAccountConnectionService();
      accountConnectionService.startLink.mockResolvedValueOnce({
        provider: 'STEAM',
        authorizationUrl: 'https://steamcommunity.com/openid/login?openid.mode=checkid_setup',
      });
      const app = await buildApp({ accountConnectionService });
      const token = generateTestToken(app);

      const response = await app.inject({
        method: 'GET',
        url: '/auth/accounts/steam/link/start',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        provider: 'STEAM',
        authorizationUrl: expect.stringContaining('steamcommunity.com/openid/login'),
      });
      expect(accountConnectionService.startLink).toHaveBeenCalledWith({
        userId: 'user-id-1',
        provider: 'steam',
      });
      await app.close();
    });

    it('bloqueia update de visibilidade sem autenticacao', async () => {
      const accountConnectionService = createAccountConnectionService();
      const app = await buildApp({ accountConnectionService });

      const response = await app.inject({
        method: 'PATCH',
        url: '/auth/connected-accounts/google/visibility',
        payload: { publicProfileVisible: true },
      });

      expect(response.statusCode).toBe(401);
      expect(accountConnectionService.updateVisibility).not.toHaveBeenCalled();
      await app.close();
    });

    it('retorna erro coerente quando visibilidade publica e bloqueada', async () => {
      const accountConnectionService = createAccountConnectionService();
      accountConnectionService.updateVisibility.mockRejectedValue({
        name: 'AccountConnectionError',
        statusCode: 409,
        reason: 'visibility_not_allowed',
        clientMessage: 'Apenas contas ativas e oficiais podem aparecer publicamente.',
      });
      const app = await buildApp({ accountConnectionService });
      const token = generateTestToken(app);

      const response = await app.inject({
        method: 'PATCH',
        url: '/auth/connected-accounts/epic/visibility',
        headers: { Authorization: `Bearer ${token}` },
        payload: { publicProfileVisible: true },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        message: 'Apenas contas ativas e oficiais podem aparecer publicamente.',
      });
      await app.close();
    });

    it('inicia reauth autenticado para conta que precisa reconectar', async () => {
      const accountConnectionService = createAccountConnectionService();
      const app = await buildApp({ accountConnectionService });
      const token = generateTestToken(app);

      const response = await app.inject({
        method: 'GET',
        url: '/auth/accounts/discord/reauth/start',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        provider: 'DISCORD',
        authorizationUrl: expect.stringContaining('state=signed-state'),
      });
      expect(accountConnectionService.startReauth).toHaveBeenCalledWith({
        userId: 'user-id-1',
        provider: 'discord',
      });
      await app.close();
    });

    it('conclui reauth sem trocar sessao CLUTCH', async () => {
      const accountConnectionService = createAccountConnectionService();
      const app = await buildApp({ accountConnectionService });

      const response = await app.inject({
        method: 'GET',
        url: '/auth/accounts/discord/reauth/callback?code=oauth-code&state=signed-state',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        provider: 'DISCORD',
        externalId: 'discord-external-id',
        status: 'CONNECTED',
        connectionType: 'CONNECTED_ACCOUNT',
      });
      expect(response.json()).not.toHaveProperty('token');
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(accountConnectionService.completeReauth).toHaveBeenCalledWith({
        provider: 'discord',
        code: 'oauth-code',
        state: 'signed-state',
        providerError: undefined,
      });
      await app.close();
    });
  });

});
