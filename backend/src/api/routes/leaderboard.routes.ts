import { FastifyInstance } from 'fastify';
import { prisma } from '../../infra/database/client';

export async function leaderboardRoutes(app: FastifyInstance) {

  // ROTA: GET /leaderboard (Top 10 Jogadores)
  app.get('/leaderboard', async (request, reply) => {
    
    // Busca os stats ordenados por XP (do maior para o menor)
    const ranking = await prisma.userStats.findMany({
      take: 10, // Top 10
      orderBy: { currentXp: 'desc' },
      include: {
        user: {
          select: {
            username: true,
            profile: {
              select: { displayName: true, avatarUrl: true }
            }
          }
        }
      }
    });

    // Formata para o frontend ficar feliz
    return ranking.map((stat, index) => ({
      rank: index + 1,
      username: stat.user.username,
      displayName: stat.user.profile?.displayName || stat.user.username,
      avatarUrl: stat.user.profile?.avatarUrl,
      level: stat.level,
      xp: stat.currentXp
    }));
  });
}