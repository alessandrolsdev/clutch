import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { userRepository } from '../../core/repositories/user.repository';
import {
  parseCookieValue,
  REFRESH_TOKEN_COOKIE_NAME,
  serializeClearedRefreshTokenCookie,
  serializeRefreshTokenCookie,
} from '../../config/auth-session';
import {
  RefreshTokenInvalidError,
  type RefreshSessionRevokeResult,
  RefreshTokenRevokedError,
  RefreshTokenReuseError,
} from '../../core/services/refresh-token.service';
import { AUTH_RATE_LIMIT_POLICIES } from '../../config/rate-limit';

// ─────────────────────────────────────────────────────────────
// Auth Routes
// POST /auth/register
// POST /auth/login
// POST /auth/refresh
// POST /auth/logout
// GET  /auth/me
// ─────────────────────────────────────────────────────────────

const SALT_ROUNDS = 12;

const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username deve ter no mínimo 3 caracteres')
    .max(30, 'Username deve ter no máximo 30 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username aceita apenas letras, números e _'),
  email:    z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

const loginSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  async function issueAuthSession(
    user: { id: string; username: string },
    reply: FastifyReply,
  ): Promise<string> {
    const session = await app.refreshTokenService.issueSession({
      id: user.id,
      username: user.username,
    });

    reply.header('Set-Cookie', serializeRefreshTokenCookie(session.refreshToken));

    return session.accessToken;
  }

  // ── POST /auth/register ──────────────────────────────────
  app.post('/register', {
    config: {
      rateLimit: AUTH_RATE_LIMIT_POLICIES.register,
    },
  }, async (request, reply) => {
    const result = registerSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        message: result.error.errors[0]?.message ?? 'Dados inválidos.',
      });
    }

    const { username, email, password } = result.data;

    const alreadyExists = await userRepository.existsByEmailOrUsername(email, username);
    if (alreadyExists) {
      return reply.status(409).send({ message: 'Email ou username já está em uso.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user         = await userRepository.create({ username, email, password: passwordHash });

    const token = await issueAuthSession(user, reply);

    request.log.info({
      event: 'auth_register_succeeded',
      requestId: request.id,
      method: request.method,
      path: request.url,
      status: 201,
      userId: user.id,
      username: user.username,
    }, 'Auth register succeeded');

    return reply.status(201).send({ id: user.id, username: user.username, token });
  });

  // ── POST /auth/login ─────────────────────────────────────
  app.post('/login', {
    config: {
      rateLimit: AUTH_RATE_LIMIT_POLICIES.login,
    },
  }, async (request, reply) => {
    const result = loginSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        message: result.error.errors[0]?.message ?? 'Dados inválidos.',
      });
    }

    const { email, password } = result.data;
    const user = await userRepository.findByEmail(email);

    if (!user) {
      request.log.warn({
        event: 'auth_login_failed',
        requestId: request.id,
        method: request.method,
        path: request.url,
        status: 401,
        reason: 'invalid_credentials',
      }, 'Auth login failed');
      return reply.status(401).send({ message: 'Credenciais inválidas.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      request.log.warn({
        event: 'auth_login_failed',
        requestId: request.id,
        method: request.method,
        path: request.url,
        status: 401,
        reason: 'invalid_credentials',
        userId: user.id,
      }, 'Auth login failed');
      return reply.status(401).send({ message: 'Credenciais inválidas.' });
    }

    const token = await issueAuthSession(user, reply);

    request.log.info({
      event: 'auth_login_succeeded',
      requestId: request.id,
      method: request.method,
      path: request.url,
      status: 200,
      userId: user.id,
      username: user.username,
    }, 'Auth login succeeded');

    return reply.status(200).send({
      id:       user.id,
      username: user.username,
      token,
      message:  'Acesso autorizado.',
    });
  });

  // ── POST /auth/refresh ───────────────────────────────────
  app.post('/refresh', {
    config: {
      rateLimit: AUTH_RATE_LIMIT_POLICIES.refresh,
    },
  }, async (request, reply) => {
    const refreshToken = parseCookieValue(request.headers.cookie, REFRESH_TOKEN_COOKIE_NAME);

    if (!refreshToken) {
      request.log.warn({
        event: 'auth_refresh_failed',
        requestId: request.id,
        method: request.method,
        path: request.url,
        status: 401,
        reason: 'missing_refresh_token',
      }, 'Refresh token is missing');
      reply.header('Set-Cookie', serializeClearedRefreshTokenCookie());
      return reply.status(401).send({ message: 'Refresh token inválido ou expirado.' });
    }

    try {
      const session = await app.refreshTokenService.rotateSession(refreshToken);

      request.log.info({
        event: 'auth_access_token_refreshed',
        requestId: request.id,
        method: request.method,
        path: request.url,
        status: 200,
      }, 'Access token refreshed');

      reply.header('Set-Cookie', serializeRefreshTokenCookie(session.refreshToken));

      return reply.status(200).send({
        token: session.accessToken,
        message: 'Sessão renovada.',
      });
    } catch (error) {
      reply.header('Set-Cookie', serializeClearedRefreshTokenCookie());

      if (error instanceof RefreshTokenReuseError) {
        request.log.warn({
          event: 'auth_refresh_failed',
          requestId: request.id,
          method: request.method,
          path: request.url,
          status: 401,
          reason: 'refresh_token_reuse',
          sessionId: error.sessionId,
        }, 'Refresh token reuse detected');
        return reply.status(401).send({ message: 'Refresh token reutilizado ou inválido.' });
      }

      if (error instanceof RefreshTokenRevokedError) {
        request.log.warn({
          event: 'auth_refresh_rejected_revoked_session',
          requestId: request.id,
          method: request.method,
          path: request.url,
          status: 401,
          sessionId: error.sessionId,
          reason: error.reason ?? 'revoked_session',
        }, 'Refresh token rejected because session is revoked');
        return reply.status(401).send({ message: 'Refresh token inválido ou expirado.' });
      }

      if (error instanceof RefreshTokenInvalidError) {
        request.log.warn({
          event: 'auth_refresh_failed',
          requestId: request.id,
          method: request.method,
          path: request.url,
          status: 401,
          reason: 'invalid_refresh_token',
        }, 'Refresh token rejected');
        return reply.status(401).send({ message: 'Refresh token inválido ou expirado.' });
      }

      throw error;
    }
  });

  // ── POST /auth/logout ────────────────────────────────────
  app.post('/logout', async (request, reply) => {
    const refreshToken = parseCookieValue(request.headers.cookie, REFRESH_TOKEN_COOKIE_NAME);
    let revocationResult: RefreshSessionRevokeResult = {
      sessionId: null,
      status: 'noop',
      reason: null,
    };

    if (refreshToken) {
      revocationResult = await app.refreshTokenService.revokeSession(refreshToken, 'logout');

      if (revocationResult.status === 'revoked') {
        request.log.info({
          event: 'auth_session_revoked',
          requestId: request.id,
          method: request.method,
          path: request.url,
          status: 200,
          sessionId: revocationResult.sessionId,
          reason: revocationResult.reason,
        }, 'Refresh session revoked');
      }
    }

    reply.header('Set-Cookie', serializeClearedRefreshTokenCookie());

    request.log.info({
      event: 'auth_logout_completed',
      requestId: request.id,
      method: request.method,
      path: request.url,
      status: 200,
      sessionId: revocationResult.sessionId,
      reason: revocationResult.reason ?? (refreshToken ? 'logout_noop' : 'missing_refresh_token'),
    }, 'Logout completed');

    return reply.status(200).send({ message: 'Sessão encerrada.' });
  });

  // ── GET /auth/me ─────────────────────────────────────────
  app.get(
    '/me',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = await userRepository.findById(request.userId);
      if (!user) return reply.status(404).send({ message: 'Usuário não encontrado.' });

      return reply.status(200).send({
        id:       user.id,
        username: user.username,
        email:    user.email,
      });
    },
  );

}
