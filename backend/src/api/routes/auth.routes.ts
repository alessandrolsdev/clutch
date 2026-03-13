import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { userRepository } from '@/core/repositories/user.repository';

// ─────────────────────────────────────────────────────────────
// Auth Routes
// POST /auth/register
// POST /auth/login
// ─────────────────────────────────────────────────────────────

const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username deve ter no mínimo 3 caracteres')
    .max(30, 'Username deve ter no máximo 30 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username aceita apenas letras, números e _'),
  email: z
    .string()
    .email('Email inválido'),
  password: z
    .string()
    .min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

const loginSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /auth/register ──────────────────────────────────
  app.post('/register', async (request, reply) => {
    const result = registerSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        message: result.error.errors[0]?.message ?? 'Dados inválidos.',
      });
    }

    const { username, email, password } = result.data;

    const alreadyExists = await userRepository.existsByEmailOrUsername(email, username);
    if (alreadyExists) {
      return reply.status(409).send({
        message: 'Email ou username já está em uso.',
      });
    }

    const user = await userRepository.create({ username, email, password });

    return reply.status(201).send({
      id:       user.id,
      username: user.username,
    });
  });

  // ── POST /auth/login ─────────────────────────────────────
  app.post('/login', async (request, reply) => {
    const result = loginSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        message: result.error.errors[0]?.message ?? 'Dados inválidos.',
      });
    }

    const { email, password } = result.data;

    const user = await userRepository.findByEmail(email);

    if (!user || user.password_hash !== password) {
      return reply.status(401).send({
        message: 'Credenciais inválidas.',
      });
    }

    return reply.status(200).send({
      id:       user.id,
      username: user.username,
      message:  'Acesso autorizado.',
    });
  });

}
