import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import multer from 'fastify-multer';
import { createWorker } from 'tesseract.js';
import { prisma } from '../../infra/database/client';

export async function imageRoutes(app: FastifyInstance) {

  // Configuração do Multer para upload de arquivos
  const upload = multer({
    storage: multer.memoryStorage(), // Salva o arquivo em memória como um Buffer
    limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Apenas imagens são permitidas!'), false);
      }
    }
  });

  // ROTA: Upload de Imagem de Conquista com OCR
  app.post('/posts/upload-achievement-image', { preHandler: upload.single('image') }, async (request, reply) => {
    // Validação básica se existe um arquivo
    if (!request.file) {
      return reply.status(400).send({ message: 'Nenhuma imagem enviada.' });
    }

    const bodySchema = z.object({
      userId: z.string().uuid(),
      gameTitle: z.string().optional(), // Título do jogo pode vir do frontend, ou tentar adivinhar
    });
    const { userId, gameTitle } = bodySchema.parse(request.body);

    const imageBuffer = request.file.buffer;
    
    // =====================================================================
    // LÓGICA DE OCR
    // Para um MVP, vamos apenas extrair texto e simular o reconhecimento.
    // Em produção, isso seria muito mais sofisticado (detecção de layout,
    // reconhecimento de ícones, machine learning).
    // =====================================================================

    try {
      const worker = await createWorker('eng+por', 1, {
        logger: m => console.log(m), // Para ver o progresso do Tesseract no console
      });

      const { data: { text } } = await worker.recognize(imageBuffer);
      await worker.terminate();

      // === SIMULAÇÃO DE RECONHECIMENTO INTELIGENTE (MVP) ===
      // Aqui, você adicionaria sua lógica para interpretar o texto.
      // Ex: procurar por palavras-chave como "Achievement Unlocked",
      // "Conquista", nomes de jogos, porcentagens, etc.
      let recognizedGameTitle = gameTitle || "Jogo Desconhecido";
      let recognizedAchievements = [];
      let recognizedPercentage = 0;

      // Exemplo muito simplificado:
      if (text.includes("Achievement Unlocked") || text.includes("Conquista Desbloqueada")) {
        recognizedAchievements.push("Conquista detectada (detalhes genéricos)");
        recognizedPercentage = Math.floor(Math.random() * 100); // Simula uma % aleatória
      } else if (text.includes("100%")) {
        recognizedPercentage = 100;
        recognizedAchievements.push("Conquista 100% detectada!");
      }

      // Pode-se tentar inferir o título do jogo de forma mais inteligente
      const gameTitleKeywords = ["elden ring", "cyberpunk", "fortnite", "valorant"];
      for (const keyword of gameTitleKeywords) {
        if (text.toLowerCase().includes(keyword)) {
          recognizedGameTitle = keyword.toUpperCase();
          break;
        }
      }

      // Simula o salvamento de um "Post" com o resultado da IA
      const post = await prisma.post.create({
        data: {
          userId: userId,
          type: 'IMAGE', // Novo tipo de post
          imageUrl: 'URL_TEMPORARIO_DA_IMAGEM', // Em produção, faríamos upload para S3/Cloudinary e salvaríamos a URL
          contentText: `IA detectou: "${recognizedGameTitle}" - Progresso: ${recognizedPercentage}%\n\nTexto OCR bruto:\n${text.substring(0, 500)}...`, // Salva o texto bruto para debug
        },
      });

      // Em um sistema real, aqui você salvaria no diário ou em um novo modelo de "AchievementProof"
      return reply.status(200).send({
        message: 'Imagem processada com sucesso!',
        ocrText: text,
        recognizedGame: recognizedGameTitle,
        recognizedAchievements: recognizedAchievements,
        recognizedPercentage: recognizedPercentage,
        postId: post.id,
      });

    } catch (error) {
      console.error("Erro no OCR ou processamento:", error);
      return reply.status(500).send({ message: 'Erro ao processar imagem.' });
    }
  });
}