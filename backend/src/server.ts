import Fastify from 'fastify';
import cors from '@fastify/cors';

// Importação das Rotas
import { authRoutes } from './api/routes/auth.routes';
import { profileRoutes } from './api/routes/profile.routes';
import { postsRoutes } from './api/routes/posts.routes';
import { interactionsRoutes } from './api/routes/interactions.routes'; // <--- 1. IMPORTAR
import { leaderboardRoutes } from './api/routes/leaderboard.routes';
import {commentsRoutes} from './api/routes/comments.routes';

const app = Fastify({
  logger: true
});

// Configuração de Segurança (CORS)
app.register(cors, { 
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// Registro das Rotas
app.register(authRoutes);
app.register(profileRoutes);
app.register(postsRoutes);
app.register(interactionsRoutes);
app.register(leaderboardRoutes);
app.register(commentsRoutes); 

const start = async () => {
  try {
    await app.listen({ port: 3333, host: '0.0.0.0' });
    console.log('🔥 CLUTCH Backend Operacional em http://localhost:3333');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();