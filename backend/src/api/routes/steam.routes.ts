import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import axios from 'axios';
import { prisma } from '../../infra/database/client';

// ⚠️ MANTENHA SUA API KEY AQUI
const STEAM_API_KEY = 'C2FF6B3F06C6DCB64B86F94578C62CA2'; 

export async function steamRoutes(app: FastifyInstance) {

  // ROTA 1: SYNC GERAL (Mantida igual)
  app.post('/integrations/steam/sync', async (request, reply) => {
    const bodySchema = z.object({ userId: z.string().uuid(), steamId: z.string() });
    const { userId, steamId } = bodySchema.parse(request.body);

    try {
      const summaryReq = await axios.get('http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/', {
        params: { key: STEAM_API_KEY, steamids: steamId }
      });
      const summary = summaryReq.data.response.players[0];

      const gamesReq = await axios.get('http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/', {
        params: { key: STEAM_API_KEY, steamid: steamId, format: 'json', include_appinfo: true, include_played_free_games: true }
      });
      const gamesData = gamesReq.data.response;

      if (!gamesData || !gamesData.games) return reply.status(400).send({ message: 'Perfil privado ou inválido.' });

      const gameCount = gamesData.game_count || 0;
      const totalMinutes = (gamesData.games || []).reduce((acc: number, game: any) => acc + (game.playtime_forever || 0), 0);
      const totalHours = Math.floor(totalMinutes / 60);

      // Pega Top 3 com progresso básico
      const top3 = (gamesData.games || []).sort((a: any, b: any) => b.playtime_forever - a.playtime_forever).slice(0, 3);
      
      const gamesWithAchievements = await Promise.all(top3.map(async (game: any) => {
        try {
          const achieveReq = await axios.get('http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/', {
            params: { key: STEAM_API_KEY, steamid: steamId, appid: game.appid }
          });
          const stats = achieveReq.data.playerstats;
          const achieved = stats.achievements?.filter((a: any) => a.achieved === 1).length || 0;
          const total = stats.achievements?.length || 0;
          
          return {
            appid: game.appid,
            name: game.name,
            hours: Math.floor(game.playtime_forever / 60),
            icon: `http://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`,
            achievements: { achieved, total, percent: total > 0 ? Math.round((achieved/total)*100) : 0 }
          };
        } catch (e) {
          return { appid: game.appid, name: game.name, hours: Math.floor(game.playtime_forever / 60), icon: `http://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`, achievements: null };
        }
      }));

      await prisma.platformIntegration.update({
        where: { userId_provider: { userId, provider: 'STEAM' } },
        data: {
          lastSyncedAt: new Date(),
          metadata: {
            realName: summary.realname, avatarFull: summary.avatarfull, country: summary.loccountrycode, status: summary.personastate, gameExtraInfo: summary.gameextrainfo,
            gameCount, totalHours, topGames: gamesWithAchievements, raw: 'Full Sync Level 3'
          }
        }
      });

      return { message: 'Sincronizado!', stats: { gameCount, totalHours } };
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ message: 'Erro ao comunicar com a Steam.' });
    }
  });

  // ROTA 2: DETALHES DAS CONQUISTAS (CORRIGIDA)
  app.post('/integrations/steam/game-details', async (request, reply) => {
    const bodySchema = z.object({ steamId: z.string(), appId: z.number() });
    const { steamId, appId } = bodySchema.parse(request.body);

    try {
      // 1. Busca o "Schema" (Nomes, Ícones e Descrições das conquistas)
      const schemaReq = await axios.get('http://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/', {
        params: { key: STEAM_API_KEY, appid: appId }
      });
      
      // 2. Busca o Progresso do Usuário (Quais ele já pegou)
      const playerReq = await axios.get('http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/', {
        params: { key: STEAM_API_KEY, steamid: steamId, appid: appId }
      });

      if (!schemaReq.data.game || !playerReq.data.playerstats) {
        return reply.status(404).send({ message: 'Dados de conquista indisponíveis.' });
      }

      // === AQUI ESTAVA O ERRO: REMOVIDO O ESPAÇO NO NOME DA VARIÁVEL ===
      const availableAchievements = schemaReq.data.game.availableGameStats.achievements || [];
      const playerAchievements = playerReq.data.playerstats.achievements || [];

      // 3. Cruza os dados (Merge)
      const richAchievements = availableAchievements.map((schemaAch: any) => {
        const playerAch = playerAchievements.find((pa: any) => pa.apiname === schemaAch.name);
        return {
            name: schemaAch.displayName,
            description: schemaAch.description, // Alguns jogos não têm descrição, pode vir vazio
            icon: schemaAch.icon, // Ícone colorido
            iconGray: schemaAch.icongray, // Ícone cinza (bloqueado)
            achieved: playerAch ? playerAch.achieved === 1 : false,
            unlockTime: playerAch ? playerAch.unlocktime : 0
        };
      });

      // Ordena: Conquistados primeiro
      richAchievements.sort((a: any, b: any) => b.achieved - a.achieved);

      return { 
        gameName: schemaReq.data.game.gameName,
        achievements: richAchievements 
      };

    } catch (error) {
      console.error(error);
      return reply.status(500).send({ message: 'Erro ao buscar detalhes do jogo.' });
    }
  });
}