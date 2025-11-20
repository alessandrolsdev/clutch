import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../infra/database/client';

export async function integrationsRoutes(app: FastifyInstance) {

  // POST /integrations (Vincular uma plataforma)
  app.post('/integrations', async (request, reply) => {
    const bodySchema = z.object({
      userId: z.string().uuid(),
      provider: z.enum(['STEAM', 'PSN', 'XBOX', 'RIOT', 'NINTENDO']),
      externalId: z.string().min(3) // O ID ou Nick na outra plataforma
    });

    const { userId, provider, externalId } = bodySchema.parse(request.body);

    // 1. Verifica se esse ID já não está sendo usado por outro usuário (Anti-Smurf)
    const existingLink = await prisma.platformIntegration.findFirst({
      where: { 
        provider, 
        externalId,
        NOT: { userId } // Ignora se for o próprio usuário atualizando
      }
    });

    if (existingLink) {
      return reply.status(409).send({ message: `Este ID da ${provider} já está vinculado a outra conta.` });
    }

    // 2. Salva ou Atualiza o Vínculo (Upsert)
    // Se eu já tinha Steam e mudei o ID, ele atualiza. Se não, cria.
    const integration = await prisma.platformIntegration.upsert({
      where: {
        userId_provider: { userId, provider } // Chave composta única
      },
      update: { externalId, lastSyncedAt: new Date() },
      create: {
        userId,
        provider,
        externalId,
        lastSyncedAt: new Date()
      }
    });

    // 3. Recompensa: Ganha XP por vincular (apenas na criação)
    // (Para simplificar neste MVP, damos XP sempre que salva, mas idealmente checaríamos se é novo)
    await prisma.userStats.update({
      where: { userId },
      data: { currentXp: { increment: 20 } }
    });

    return reply.status(201).send(integration);
  });

  // GET /integrations/:username (Ler as conexões de alguém)
  // (Nota: Já estamos trazendo isso dentro do /profile/:username, então essa rota é opcional,
  // mas boa para debugging)
}