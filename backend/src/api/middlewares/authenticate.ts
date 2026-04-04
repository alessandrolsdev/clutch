import { FastifyRequest, FastifyReply } from 'fastify';
import { extractBearerToken, type JwtPayload } from '../../config/jwt';

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
      return reply.status(401).send({ message: 'Token inválido ou expirado.' });
    }

    const payload = request.server.verifyAccessToken(token) as JwtPayload;
    request.userId   = payload.id;
    request.username = payload.username;
  } catch {
    return reply.status(401).send({ message: 'Token inválido ou expirado.' });
  }
}
