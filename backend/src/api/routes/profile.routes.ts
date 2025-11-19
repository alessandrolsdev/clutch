import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../infra/database/client';

export async function profileRoutes(app: FastifyInstance) {
  
  // === ROTA 1: LEITURA (GET) ===
  app.get('/profiles/:username', async (request, reply) => {
    const paramsSchema = z.object({
      username: z.string()
    });
    const { username } = paramsSchema.parse(request.params);

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        profile: true, 
        stats: true,
      }
    });

    if (!user) {
      return reply.status(404).send({ message: 'Gamer não encontrado.' });
    }

    return {
      id: user.id, 
      username: user.username,
      displayName: user.profile?.displayName,
      bio: user.profile?.bio || 'Um mistério a ser desvendado.',
      avatarUrl: user.profile?.avatarUrl,
      level: user.stats?.level || 1,
      energy: user.stats?.socialEnergy || 100,
      xp: user.stats?.currentXp || 0,
    };
  });


  // === ROTA 2: ATUALIZAÇÃO (PATCH) ===
  // O erro acontecia porque este bloco estava invisível para o servidor
  app.patch('/profiles/:username', async (request, reply) => {
    
    // 1. Validações
    const paramsSchema = z.object({ username: z.string() });
    
    const updateBodySchema = z.object({
      displayName: z.string().optional(),
      bio: z.string().max(500).optional(),
      avatarUrl: z.string().url().optional().or(z.literal('')),
      bannerUrl: z.string().url().optional().or(z.literal(''))
    });

    const { username } = paramsSchema.parse(request.params);
    const data = updateBodySchema.parse(request.body);

    // 2. Busca o usuário dono do perfil
    const user = await prisma.user.findUnique({ where: { username } });
    
    if (!user) {
      return reply.status(404).send({ message: 'Usuário não existe.' });
    }

    // 3. Atualiza no Banco
    try {
      const updatedProfile = await prisma.profile.update({
        where: { userId: user.id },
        data: {
          displayName: data.displayName,
          bio: data.bio,
          avatarUrl: data.avatarUrl,
          bannerUrl: data.bannerUrl
        }
      });

      return updatedProfile;
      
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ message: 'Erro interno ao atualizar banco.' });
    }
  });

}