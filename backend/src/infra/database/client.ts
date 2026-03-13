import { PrismaClient } from '@prisma/client';

// ─────────────────────────────────────────────────────────────
// Singleton do Prisma Client
// Evita múltiplas instâncias em desenvolvimento com hot reload
// ─────────────────────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
