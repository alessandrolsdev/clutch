import { FastifyRequest, FastifyReply } from 'fastify';

// ─────────────────────────────────────────────────────────────
// Authenticate Middleware
// Valida JWT e injeta userId no request
// ─────────────────────────────────────────────────────────────

export interface JwtPayload {
  id:       string;
  username: string;
}

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
    const payload = await request.jwtVerify<JwtPayload>();
    request.userId   = payload.id;
    request.username = payload.username;
  } catch {
    return reply.status(401).send({ message: 'Token inválido ou expirado.' });
  }
}