import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../infra/database/client';

export async function diaryRoutes(app: FastifyInstance) {

  // POST /diary (Registrar Zeramento)
  app.post('/diary', async (request, reply) => {
    const bodySchema = z.object({
      userId: z.string().uuid(),
      gameTitle: z.string().min(1),
      platform: z.enum(['PC', 'PS5', 'XBOX', 'SWITCH', 'MOBILE']),
      hoursPlayed: z.number().min(0),
      rating: z.number().min(1).max(5),
      emotion: z.enum(['EPIC', 'SAD', 'RAGE', 'CHILL', 'SCARY']),
      review: z.string().optional()
    });

    const data = bodySchema.parse(request.body);

    // Transação: Cria o Log E cria o Post no Feed automaticamente
    const result = await prisma.$transaction(async (tx) => {
      
      // 1. Cria o registro no Diário
      const log = await tx.gameLog.create({
        data: {
          userId: data.userId,
          gameTitle: data.gameTitle,
          platform: data.platform,
          hoursPlayed: data.hoursPlayed,
          rating: data.rating,
          emotion: data.emotion,
          review: data.review
        }
      });

      // 2. Cria o Post no Feed (Formatado bonito)
      // Vamos usar emojis baseados na emoção
      const emotionMap: Record<string, string> = {
        'EPIC': '🔥', 'SAD': '😭', 'RAGE': '😡', 'CHILL': '☕', 'SCARY': '💀'
      };
      const emoji = emotionMap[data.emotion] || '🎮';

      const postContent = `Acabei de zerar **${data.gameTitle}**! ${emoji}\n\n` +
                          `⏳ Tempo: ${data.hoursPlayed}h | ⭐ Nota: ${data.rating}/5\n` +
                          `"${data.review || 'Sem palavras para descrever.'}"`;

      await tx.post.create({
        data: {
          userId: data.userId,
          contentText: postContent,
          type: 'ACHIEVEMENT' // Tipo especial de post
        }
      });

      // 3. Dá muito XP (Zeramento vale ouro!)
      await tx.userStats.update({
        where: { userId: data.userId },
        data: { currentXp: { increment: 50 } } // 50 XP por zerar!
      });

      return log;
    });

    return reply.status(201).send(result);
  });

  // GET /diary/:username (Ler o Diário de alguém)
  app.get('/diary/:username', async (request, reply) => {
    const { username } = z.object({ username: z.string() }).parse(request.params);
    
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return reply.status(404).send({ message: 'User not found' });

    const logs = await prisma.gameLog.findMany({
      where: { userId: user.id },
      orderBy: { finishedAt: 'desc' }
    });

    return logs;
  });
}