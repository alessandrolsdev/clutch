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
import { AccountConnectionError } from '../../core/services/account-connection.service';
import { SocialAuthError } from '../../core/services/social-auth.service';
import { AUTH_RATE_LIMIT_POLICIES } from '../../config/rate-limit';
import { sanitizeRequestPath } from '../../config/logging';

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

const socialProviderParamsSchema = z.object({
  provider: z.string().min(1),
});

const accountConnectionProviderParamsSchema = z.object({
  provider: z.string().min(1),
});

const accountVisibilityUpdateSchema = z.object({
  publicProfileVisible: z.boolean(),
});

const socialCallbackSchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
}).refine(
  (input) => Boolean(input.error) || (Boolean(input.code) && Boolean(input.state)),
  {
    message: 'Callback social inválido.',
  },
);

const accountConnectionCallbackSchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
}).passthrough().refine(
  (input) => Boolean(input.error) ||
    (Boolean(input.code) && Boolean(input.state)) ||
    (Boolean(input.state) && typeof input['openid.mode'] === 'string'),
  {
    message: 'Callback de conexão inválido.',
  },
);

function toStringQueryRecord(input: Record<string, unknown>): Record<string, string | undefined> {
  const output: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      output[key] = value;
    }
  }

  return output;
}

function replyWithSocialAuthError(error: unknown): { statusCode: number; payload: { message: string } } {
  if (error instanceof SocialAuthError) {
    return {
      statusCode: error.statusCode,
      payload: {
        message: error.clientMessage,
      },
    };
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'SocialAuthError' &&
    'statusCode' in error &&
    typeof (error as { statusCode?: unknown }).statusCode === 'number' &&
    'clientMessage' in error &&
    typeof (error as { clientMessage?: unknown }).clientMessage === 'string'
  ) {
    return {
      statusCode: (error as { statusCode: number }).statusCode,
      payload: {
        message: (error as { clientMessage: string }).clientMessage,
      },
    };
  }

  throw error;
}

function replyWithAccountConnectionError(error: unknown): { statusCode: number; payload: { message: string } } {
  if (error instanceof AccountConnectionError) {
    return {
      statusCode: error.statusCode,
      payload: {
        message: error.clientMessage,
      },
    };
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AccountConnectionError' &&
    'statusCode' in error &&
    typeof (error as { statusCode?: unknown }).statusCode === 'number' &&
    'clientMessage' in error &&
    typeof (error as { clientMessage?: unknown }).clientMessage === 'string'
  ) {
    return {
      statusCode: (error as { statusCode: number }).statusCode,
      payload: {
        message: (error as { clientMessage: string }).clientMessage,
      },
    };
  }

  throw error;
}

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
      path: sanitizeRequestPath(request.url),
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
        path: sanitizeRequestPath(request.url),
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
        path: sanitizeRequestPath(request.url),
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
      path: sanitizeRequestPath(request.url),
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

  // ── GET /auth/social/:provider/start ─────────────────────
  app.get<{ Params: { provider: string } }>(
    '/social/:provider/start',
    {
      config: {
        rateLimit: AUTH_RATE_LIMIT_POLICIES.login,
      },
    },
    async (request, reply) => {
      const paramsResult = socialProviderParamsSchema.safeParse(request.params);

      if (!paramsResult.success) {
        return reply.status(400).send({ message: 'Provider social inválido.' });
      }

      try {
        const resultPayload = await app.socialAuthService.startLogin(paramsResult.data.provider);

        request.log.info({
          event: 'auth_social_login_started',
          requestId: request.id,
          method: request.method,
          path: sanitizeRequestPath(request.url),
          provider: resultPayload.provider,
          status: 200,
        }, 'Social auth login started');

        return reply.status(200).send(resultPayload);
      } catch (error) {
        const socialError = replyWithSocialAuthError(error);
        return reply.status(socialError.statusCode).send(socialError.payload);
      }
    },
  );

  // ── GET /auth/social/:provider/callback ──────────────────
  app.get<{
    Params: { provider: string };
    Querystring: Record<string, string | undefined>;
  }>(
    '/social/:provider/callback',
    {
      config: {
        rateLimit: AUTH_RATE_LIMIT_POLICIES.login,
      },
    },
    async (request, reply) => {
      const paramsResult = socialProviderParamsSchema.safeParse(request.params);

      if (!paramsResult.success) {
        return reply.status(400).send({ message: 'Provider social inválido.' });
      }

      const queryResult = socialCallbackSchema.safeParse(request.query);

      if (!queryResult.success) {
        return reply.status(400).send({ message: 'Callback social inválido.' });
      }

      try {
        const socialResult = await app.socialAuthService.completeCallback({
          provider: paramsResult.data.provider,
          code: queryResult.data.code,
          state: queryResult.data.state,
          providerError: queryResult.data.error,
          requestId: request.id,
        });
        const token = await issueAuthSession(socialResult.user, reply);

        request.log.info({
          event: 'auth_social_login_succeeded',
          requestId: request.id,
          method: request.method,
          path: sanitizeRequestPath(request.url),
          provider: socialResult.provider,
          status: 200,
          userId: socialResult.user.id,
          username: socialResult.user.username,
          isNewUser: socialResult.isNewUser,
        }, 'Social auth login succeeded');

        return reply.status(200).send({
          id: socialResult.user.id,
          username: socialResult.user.username,
          token,
          message: 'Acesso autorizado.',
        });
      } catch (error) {
        const socialError = replyWithSocialAuthError(error);
        return reply.status(socialError.statusCode).send(socialError.payload);
      }
    },
  );

  // ── GET /auth/connected-accounts ─────────────────────────
  app.get(
    '/connected-accounts',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const resultPayload = await app.accountConnectionService.listConnectedAccounts(request.userId);

      return reply.status(200).send(resultPayload);
    },
  );

  // ── GET /auth/accounts/:provider/link/start ──────────────
  app.get<{ Params: { provider: string } }>(
    '/accounts/:provider/link/start',
    {
      preHandler: [app.authenticate],
      config: {
        rateLimit: AUTH_RATE_LIMIT_POLICIES.login,
      },
    },
    async (request, reply) => {
      const paramsResult = accountConnectionProviderParamsSchema.safeParse(request.params);

      if (!paramsResult.success) {
        return reply.status(400).send({ message: 'Provider de conta inválido.' });
      }

      try {
        const resultPayload = await app.accountConnectionService.startLink({
          userId: request.userId,
          provider: paramsResult.data.provider,
        });

        request.log.info({
          event: 'auth_account_link_started',
          requestId: request.id,
          method: request.method,
          path: sanitizeRequestPath(request.url),
          provider: resultPayload.provider,
          status: 200,
          userId: request.userId,
        }, 'Account link started');

        return reply.status(200).send(resultPayload);
      } catch (error) {
        const accountError = replyWithAccountConnectionError(error);
        return reply.status(accountError.statusCode).send(accountError.payload);
      }
    },
  );

  // ── GET /auth/accounts/:provider/link/callback ───────────
  app.get<{
    Params: { provider: string };
    Querystring: { code?: string; state?: string; error?: string };
  }>(
    '/accounts/:provider/link/callback',
    {
      config: {
        rateLimit: AUTH_RATE_LIMIT_POLICIES.login,
      },
    },
    async (request, reply) => {
      const paramsResult = accountConnectionProviderParamsSchema.safeParse(request.params);

      if (!paramsResult.success) {
        return reply.status(400).send({ message: 'Provider de conta inválido.' });
      }

      const queryResult = accountConnectionCallbackSchema.safeParse(request.query);

      if (!queryResult.success) {
        return reply.status(400).send({ message: 'Callback de conexão inválido.' });
      }

      try {
        const queryValues = toStringQueryRecord(queryResult.data);
        const resultPayload = await app.accountConnectionService.completeLink({
          provider: paramsResult.data.provider,
          code: queryValues['code'],
          state: queryValues['state'],
          providerError: queryValues['error'],
          openIdParams: queryValues,
        });

        request.log.info({
          event: 'auth_account_link_succeeded',
          requestId: request.id,
          method: request.method,
          path: `/auth/accounts/${resultPayload.provider.toLowerCase()}/link/callback`,
          provider: resultPayload.provider,
          status: 200,
          connectionType: resultPayload.connectionType,
        }, 'Account link succeeded');

        return reply.status(200).send(resultPayload);
      } catch (error) {
        const accountError = replyWithAccountConnectionError(error);
        return reply.status(accountError.statusCode).send(accountError.payload);
      }
    },
  );

  // ── DELETE /auth/accounts/:provider ──────────────────────
  app.delete<{ Params: { provider: string } }>(
    '/accounts/:provider',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const paramsResult = accountConnectionProviderParamsSchema.safeParse(request.params);

      if (!paramsResult.success) {
        return reply.status(400).send({ message: 'Provider de conta inválido.' });
      }

      try {
        const resultPayload = await app.accountConnectionService.unlink({
          userId: request.userId,
          provider: paramsResult.data.provider,
        });

        request.log.info({
          event: 'auth_account_unlinked',
          requestId: request.id,
          method: request.method,
          path: sanitizeRequestPath(request.url),
          provider: resultPayload.provider,
          status: 200,
          userId: request.userId,
        }, 'Account unlinked');

        return reply.status(200).send(resultPayload);
      } catch (error) {
        const accountError = replyWithAccountConnectionError(error);
        return reply.status(accountError.statusCode).send(accountError.payload);
      }
    },
  );

  // ── PATCH /auth/connected-accounts/:provider/visibility ──
  app.patch<{
    Params: { provider: string };
    Body: { publicProfileVisible?: unknown };
  }>(
    '/connected-accounts/:provider/visibility',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const paramsResult = accountConnectionProviderParamsSchema.safeParse(request.params);

      if (!paramsResult.success) {
        return reply.status(400).send({ message: 'Provider de conta inválido.' });
      }

      const bodyResult = accountVisibilityUpdateSchema.safeParse(request.body);

      if (!bodyResult.success) {
        return reply.status(400).send({ message: 'Preferência de visibilidade inválida.' });
      }

      try {
        const resultPayload = await app.accountConnectionService.updateVisibility({
          userId: request.userId,
          provider: paramsResult.data.provider,
          publicProfileVisible: bodyResult.data.publicProfileVisible,
        });

        request.log.info({
          event: 'auth_connected_account_visibility_updated',
          requestId: request.id,
          method: request.method,
          path: `/auth/connected-accounts/${resultPayload.provider.toLowerCase()}/visibility`,
          provider: resultPayload.provider,
          publicProfileVisible: resultPayload.publicProfileVisible,
          status: 200,
          userId: request.userId,
        }, 'Connected account visibility updated');

        return reply.status(200).send(resultPayload);
      } catch (error) {
        const accountError = replyWithAccountConnectionError(error);
        return reply.status(accountError.statusCode).send(accountError.payload);
      }
    },
  );

  // ── GET /auth/accounts/:provider/reauth/start ────────────
  app.get<{ Params: { provider: string } }>(
    '/accounts/:provider/reauth/start',
    {
      preHandler: [app.authenticate],
      config: {
        rateLimit: AUTH_RATE_LIMIT_POLICIES.login,
      },
    },
    async (request, reply) => {
      const paramsResult = accountConnectionProviderParamsSchema.safeParse(request.params);

      if (!paramsResult.success) {
        return reply.status(400).send({ message: 'Provider de conta inválido.' });
      }

      try {
        const resultPayload = await app.accountConnectionService.startReauth({
          userId: request.userId,
          provider: paramsResult.data.provider,
        });

        request.log.info({
          event: 'auth_account_reauth_started',
          requestId: request.id,
          method: request.method,
          path: sanitizeRequestPath(request.url),
          provider: resultPayload.provider,
          status: 200,
          userId: request.userId,
        }, 'Account reauth started');

        return reply.status(200).send(resultPayload);
      } catch (error) {
        const accountError = replyWithAccountConnectionError(error);
        return reply.status(accountError.statusCode).send(accountError.payload);
      }
    },
  );

  // ── GET /auth/accounts/:provider/reauth/callback ─────────
  app.get<{
    Params: { provider: string };
    Querystring: { code?: string; state?: string; error?: string };
  }>(
    '/accounts/:provider/reauth/callback',
    {
      config: {
        rateLimit: AUTH_RATE_LIMIT_POLICIES.login,
      },
    },
    async (request, reply) => {
      const paramsResult = accountConnectionProviderParamsSchema.safeParse(request.params);

      if (!paramsResult.success) {
        return reply.status(400).send({ message: 'Provider de conta inválido.' });
      }

      const queryResult = socialCallbackSchema.safeParse(request.query);

      if (!queryResult.success) {
        return reply.status(400).send({ message: 'Callback de reconexão inválido.' });
      }

      try {
        const resultPayload = await app.accountConnectionService.completeReauth({
          provider: paramsResult.data.provider,
          code: queryResult.data.code,
          state: queryResult.data.state,
          providerError: queryResult.data.error,
        });

        request.log.info({
          event: 'auth_account_reauth_succeeded',
          requestId: request.id,
          method: request.method,
          path: `/auth/accounts/${resultPayload.provider.toLowerCase()}/reauth/callback`,
          provider: resultPayload.provider,
          status: 200,
          connectionType: resultPayload.connectionType,
        }, 'Account reauth succeeded');

        return reply.status(200).send(resultPayload);
      } catch (error) {
        const accountError = replyWithAccountConnectionError(error);
        return reply.status(accountError.statusCode).send(accountError.payload);
      }
    },
  );

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
        path: sanitizeRequestPath(request.url),
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
        path: sanitizeRequestPath(request.url),
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
          path: sanitizeRequestPath(request.url),
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
          path: sanitizeRequestPath(request.url),
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
          path: sanitizeRequestPath(request.url),
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
          path: sanitizeRequestPath(request.url),
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
      path: sanitizeRequestPath(request.url),
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
