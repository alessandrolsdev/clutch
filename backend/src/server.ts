import Fastify from 'fastify';
import cors from '@fastify/cors';
import multer from 'fastify-multer'; // Importante para o upload de imagens

// --- IMPORTAÇÃO DAS ROTAS ---
import { authRoutes } from './api/routes/auth.routes';
import { profileRoutes } from './api/routes/profile.routes';
import { postsRoutes } from './api/routes/posts.routes';
import { interactionsRoutes } from './api/routes/interactions.routes';
import { diaryRoutes } from './api/routes/diary.routes';
import { leaderboardRoutes } from './api/routes/leaderboard.routes';
import { integrationsRoutes } from './api/routes/integrations.routes';
import { steamRoutes } from './api/routes/steam.routes';
import { commentsRoutes } from './api/routes/comments.routes';
import { imageRoutes } from './api/routes/image.routes';

// 1. CRIAÇÃO DO SERVIDOR (O motor liga aqui)
const app = Fastify({
  logger: true
});

// 2. REGISTRO DE PLUGINS GLOBAIS
// CORS (Permite o frontend falar com o backend)
app.register(cors, { 
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// Multer (Permite upload de arquivos)
app.register(multer.contentParser);

// 3. REGISTRO DAS ROTAS (Ligar os módulos)
// A ordem aqui não importa tanto, desde que 'app' já exista.
app.register(authRoutes);
app.register(profileRoutes);
app.register(postsRoutes);
app.register(interactionsRoutes);
app.register(diaryRoutes);
app.register(leaderboardRoutes);
app.register(integrationsRoutes);
app.register(commentsRoutes);
app.register(steamRoutes);
app.register(imageRoutes);

// 4. INICIALIZAÇÃO (Start)
const start = async () => {
  try {
    // Ouve em todas as interfaces (0.0.0.0) na porta 3333
    await app.listen({ port: 3333, host: '0.0.0.0' });
    console.log('🔥 CLUTCH Backend Operacional em http://localhost:3333');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();