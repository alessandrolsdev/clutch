import '@fastify/jwt';
import { FastifyRequest, FastifyReply } from 'fastify';

// ─────────────────────────────────────────────────────────────
// Type augmentation — adiciona authenticate ao FastifyInstance
// e userId/username ao FastifyRequest
// ─────────────────────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }

  interface FastifyRequest {
    userId:   string;
    username: string;
  }
}