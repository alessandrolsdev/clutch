// backend/prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando Gênesis (Seeding)...')

  // Lista de Lendas para criar
  const legends = [
    { 
      username: 'FakerGod', 
      email: 'faker@t1.gg', 
      bio: '3x World Champion. O Rei Demônio Imortal.',
      avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Faker',
      posts: ['Apenas mais um dia no escritório. #T1Fighting', 'Ryze está forte nesse patch.'],
      xp: 1500 // Ele vai estar na sua frente no ranking
    },
    { 
      username: 'GeraltOfRivia', 
      email: 'geralt@witcher.com', 
      bio: 'Caçador de Monstros. Odeio portais.',
      avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Geralt',
      posts: ['O vento está uivando...', 'Alguém viu a Ciri?', 'Gwent > Salvar o mundo.'],
      xp: 850
    },
    { 
      username: 'JinxChaos', 
      email: 'jinx@zaun.net', 
      bio: 'Eu sou a própria desgraça!',
      avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Jinx',
      posts: ['Explodir coisas é tão divertido!', 'Cadê a Vi?'],
      xp: 1200
    },
    { 
      username: 'MarioPlumber', 
      email: 'mario@nintendo.jp', 
      bio: 'It is me! Salvando princesas desde 85.',
      avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Mario',
      posts: ['Mamma Mia!', 'O castelo estava vazio... de novo.'],
      xp: 500
    },
    { 
      username: 'SatoruGojo', 
      email: 'gojo@jjk.jp', 
      bio: 'O mais forte. Simples assim.',
      avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Gojo',
      posts: ['Vazio Roxo 🟣', 'Ensinar é cansativo, talvez eu compre doces.'],
      xp: 5000 // O Top 1 inalcançável (por enquanto)
    }
  ]

  for (const legend of legends) {
    // 1. Cria o Usuário
    const user = await prisma.user.upsert({
      where: { email: legend.email },
      update: {}, // Se já existe, não faz nada
      create: {
        username: legend.username,
        email: legend.email,
        password_hash: '123456', // Senha padrão pra todos
        profile: {
          create: {
            displayName: legend.username,
            bio: legend.bio,
            avatarUrl: legend.avatar
          }
        },
        stats: {
          create: {
            level: Math.floor(legend.xp / 100), // Nível baseado no XP
            currentXp: legend.xp,
            socialEnergy: 100
          }
        }
      }
    })

    console.log(`✅ Lenda criada: ${legend.username}`)

    // 2. Cria os Posts da Lenda
    for (const content of legend.posts) {
      await prisma.post.create({
        data: {
          userId: user.id,
          contentText: content,
          type: 'TEXT'
        }
      })
    }
  }

  console.log('🚀 Gênesis concluída. A Arena está povoada.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })