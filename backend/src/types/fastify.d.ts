/* eslint-disable @typescript-eslint/no-unused-vars, no-unused-vars */
import { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from '../config/jwt';

// ─────────────────────────────────────────────────────────────
// Type augmentation — adiciona authenticate ao FastifyInstance
// e userId/username ao FastifyRequest
// ─────────────────────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    signAccessToken(payload: JwtPayload): string;
    verifyAccessToken(token: string): JwtPayload;
  }

  interface FastifyRequest {
    userId:   string;
    username: string;
  }
}
