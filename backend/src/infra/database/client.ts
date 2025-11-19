import { PrismaClient } from '@prisma/client'

// Padrão Singleton: Garante apenas uma conexão ativa para economizar recursos
export const prisma = new PrismaClient({
  log: ['query', 'error'], // Vamos ver os SQLs rodando no terminal (modo debug)
})