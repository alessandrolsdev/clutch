import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import {
  extractBearerToken,
  JwtKidRejectedError,
  type VerifiedJwtPayload,
} from '../../config/jwt';

// ─────────────────────────────────────────────────────────────
// Authenticate Middleware
// Valida JWT e injeta userId no request
// ─────────────────────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyRequest {
    userId:   string;
    username: string;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply:   FastifyReply,
): Promise<void> {
  try {
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      request.log.warn({
        event: 'auth_access_token_rejected',
        requestId: request.id,
        method: request.method,
        path: request.url,
        status: 401,
        reason: 'missing_access_token',
      }, 'Access token is missing or malformed');
      return reply.status(401).send({ message: 'Token inválido ou expirado.' });
    }

    const payload = request.server.verifyAccessToken(token) as VerifiedJwtPayload;
    request.log.info({
      event: 'auth_jwt_key_selected',
      requestId: request.id,
      method: request.method,
      path: request.url,
      kid: payload.keyId,
      tokenKid: payload.tokenKeyId,
      legacyToken: payload.legacyToken,
    }, 'JWT key selected for access token verification');
    request.userId   = payload.id;
    request.username = payload.username;
  } catch (error) {
    if (error instanceof JwtKidRejectedError) {
      request.log.warn({
        event: 'auth_jwt_kid_rejected',
        requestId: request.id,
        method: request.method,
        path: request.url,
        status: 401,
        kid: error.kid,
        reason: error.reason,
      }, 'JWT kid rejected');
      return reply.status(401).send({ message: 'Token inválido ou expirado.' });
    }

    if (error instanceof jwt.TokenExpiredError) {
      request.log.warn({
        event: 'auth_access_token_expired',
        requestId: request.id,
        method: request.method,
        path: request.url,
        status: 401,
      }, 'Access token expired');
    } else {
      request.log.warn({
        event: 'auth_access_token_rejected',
        requestId: request.id,
        method: request.method,
        path: request.url,
        status: 401,
        reason: 'invalid_access_token',
      }, 'Access token rejected');
    }

    return reply.status(401).send({ message: 'Token inválido ou expirado.' });
  }
}
