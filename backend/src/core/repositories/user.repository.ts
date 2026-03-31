import { User } from '@prisma/client';
import { prisma } from '../../infra/database/client';

// ─────────────────────────────────────────────────────────────
// User Repository
// Toda comunicação com a tabela users passa por aqui
// Rotas e services nunca chamam o Prisma diretamente
// ─────────────────────────────────────────────────────────────

export interface CreateUserInput {
  username: string;
  email:    string;
  password: string;
}

export const userRepository = {

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  },

  async findByUsername(username: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { username } });
  },

  async existsByEmailOrUsername(email: string, username: string): Promise<boolean> {
    const user = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { id: true },
    });
    return user !== null;
  },

  async create(input: CreateUserInput): Promise<User> {
    return prisma.user.create({
      data: {
        username:      input.username,
        email:         input.email,
        password_hash: input.password,
        profile: {
          create: {
            displayName: input.username,
          },
        },
        stats: {
          create: {
            level: 1,
            xp:    0,
          },
        },
        presence: {
          create: {
            status: 'OFFLINE',
          },
        },
      },
    });
  },

};
