import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../infra/database/client'

export async function authRoutes(app: FastifyInstance) {
  
  // ROTA 1: REGISTRO (CRIAR CONTA)
  app.post('/users', async (request, reply) => {
    const createUserSchema = z.object({
      username: z.string().min(3),
      email: z.string().email(),
      password: z.string().min(6)
    })

    const { username, email, password } = createUserSchema.parse(request.body)

    const userExists = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    })

    if (userExists) return reply.status(409).send({ message: 'Usuário ou Email já cadastrado.' })

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password_hash: password, // MVP: Senha pura (Em produção usaríamos bcrypt)
        profile: { create: { displayName: username } },
        stats: { create: { socialEnergy: 100, level: 1, currentXp: 0 } }
      }
    })

    return reply.status(201).send({ id: user.id, username: user.username })
  })

  // ROTA 2: LOGIN (ENTRAR) <--- NOVA
  app.post('/login', async (request, reply) => {
    const loginSchema = z.object({
      email: z.string().email(),
      password: z.string()
    })

    const { email, password } = loginSchema.parse(request.body)

    // Busca usuário pelo email
    const user = await prisma.user.findUnique({
      where: { email }
    })

    // Verifica se existe e se a senha bate
    if (!user || user.password_hash !== password) {
      return reply.status(401).send({ message: 'Credenciais inválidas.' })
    }

    // Login Sucesso! Retorna quem ele é
    return {
      id: user.id,
      username: user.username,
      message: 'Acesso Autorizado.'
    }
  })

}