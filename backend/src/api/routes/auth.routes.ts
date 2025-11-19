import { FastifyInstance } from 'fastify'
import { z } from 'zod' // O Xerife da validação
import { prisma } from '../../infra/database/client'

export async function authRoutes(app: FastifyInstance) {
  
  // ROTA: POST /users (Criar conta)
  app.post('/users', async (request, reply) => {
    
    // 1. Definição do Contrato (O que esperamos receber?)
    const createUserSchema = z.object({
      username: z.string().min(3, "Username muito curto"),
      email: z.string().email("Email inválido"),
      password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres")
      // Futuro: Adicionar hash da senha aqui (bcrypt), mas MVP vai raw por enquanto
    })

    // 2. Validação
    // Se os dados estiverem errados, o Zod explode um erro aqui e o Fastify devolve 400
    const { username, email, password } = createUserSchema.parse(request.body)

    // 3. Regra de Negócio: Verificar duplicidade
    const userExists = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    })

    if (userExists) {
      return reply.status(409).send({ message: 'Usuário ou Email já cadastrado.' })
    }

    // 4. Persistência (Salvar no Banco)
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password_hash: password,
        
        // Gaveta 1: O Perfil Visual
        profile: {
          create: {
            displayName: username,
            // socialEnergy NÃO entra aqui
          }
        },

        // Gaveta 2: Os Status de Jogo (Aqui sim entra a energia)
        stats: {
          create: {
            socialEnergy: 100,
            level: 1,
            currentXp: 0
          }
        }
      }
    })

    // 5. Resposta (201 Created)
    return reply.status(201).send({ 
      id: user.id, 
      username: user.username,
      message: 'Bem-vindo à CLUTCH. Sua identidade foi forjada.' 
    })
  })
}