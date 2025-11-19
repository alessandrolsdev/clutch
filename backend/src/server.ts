// backend/src/server.ts
import Fastify from 'fastify';

const app = Fastify({
  logger: true // Log de alta performance ativado
});

app.get('/', async (request, reply) => {
  return { message: 'Backend Nexus Operacional 🚀', status: 'active' };
});

const start = async () => {
  try {
    await app.listen({ port: 3333 });
    console.log('🔥 Servidor rodando em http://localhost:3333');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();