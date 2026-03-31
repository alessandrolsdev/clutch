import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { profileRepository } from '../../core/repositories/profile.repository';
import { userRepository } from '../../core/repositories/user.repository';

// ─────────────────────────────────────────────────────────────
// Profile Routes
// GET   /profiles/:username  — público
// PATCH /profiles/:username  — autenticado
// ─────────────────────────────────────────────────────────────

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio:         z.string().max(300).optional(),
  avatarUrl:   z.string().url('URL de avatar inválida').optional(),
  bannerUrl:   z.string().url('URL de banner inválida').optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser um hex válido ex: #FF5500')
    .optional(),
});

export async function profileRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /profiles/:username ──────────────────────────────
  app.get<{ Params: { username: string } }>(
    '/:username',
    async (request, reply) => {
      const profile = await profileRepository.findFullProfileByUsername(request.params.username);
      if (!profile) return reply.status(404).send({ message: 'Perfil não encontrado.' });
      return reply.status(200).send(profile);
    },
  );

  // ── PATCH /profiles/:username ────────────────────────────
  app.patch<{ Params: { username: string } }>(
    '/:username',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = await userRepository.findByUsername(request.params.username);
      if (!user) return reply.status(404).send({ message: 'Usuário não encontrado.' });

      if (user.id !== request.userId) {
        return reply.status(403).send({ message: 'Você não tem permissão para editar este perfil.' });
      }

      const result = updateProfileSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ message: result.error.errors[0]?.message ?? 'Dados inválidos.' });
      }

      const updated = await profileRepository.updateByUserId(user.id, result.data);
      return reply.status(200).send(updated);
    },
  );

}
