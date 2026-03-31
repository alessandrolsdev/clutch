# CLUTCH ⚡

> **The ultimate gaming & geek social ecosystem.**

[![CI](https://github.com/alessandrolsdev/clutch/actions/workflows/ci.yml/badge.svg)](https://github.com/alessandrolsdev/clutch/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-20-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![Prisma](https://img.shields.io/badge/Prisma-5-black)

CLUTCH é uma rede social para gamers, otakus e geeks. Perfil unificado, Rich Presence em tempo real, biblioteca de jogos integrada com Steam e Epic, sistema de amizades e feed social — tudo em um único lugar.

---

## 🛠️ Stack

| Camada | Tecnologia | Função |
|---|---|---|
| **API** | Node.js 20 + Fastify + TypeScript | Backend principal |
| **Presença** | Go + goroutines | WebSockets de alta escala |
| **Integração** | Python + FastAPI | Auth Epic Games |
| **Banco** | PostgreSQL 15 | Dados relacionais |
| **Cache** | Redis 7 | Sessões, presença, pub/sub |
| **ORM** | Prisma 5 | Queries type-safe |
| **Frontend** | Next.js 15 + Tailwind | Interface |

---

## 📋 Pré-requisitos

- [Node.js 20+](https://nodejs.org)
- [Docker + Docker Compose](https://www.docker.com)
- [Go 1.22+](https://golang.org) *(para o presence-service)*
- [Git](https://git-scm.com)

---

## 🚀 Como rodar localmente

### 1. Clonar o repositório
```bash
git clone https://github.com/alessandrolsdev/clutch.git
cd clutch
```

### 2. Subir Postgres e Redis
```bash
docker-compose up -d
```

### 3. Configurar variáveis de ambiente
```bash
cd backend
cp .env.example .env
# Edite o .env com seus valores
```

### 4. Instalar dependências
```bash
npm install
```

### 5. Rodar as migrations
```bash
npx prisma migrate dev
```

### 6. Popular o banco com dados demo
```bash
npm run db:seed
```

O seed é determinístico, pode ser reexecutado e não depende de Steam, IGDB, Epic ou Discord para concluir.

**Conta demo após o seed:**
```txt
Email: clutchplayer@clutch.gg
Senha: clutch123
```

### 7. Iniciar o servidor
```bash
npm run dev
```

O backend estará disponível em `http://localhost:3333`.

**Health check:**
```bash
curl http://localhost:3333/health
# { "status": "ok", "service": "clutch-backend" }
```

---

## Frontend foundation

Com a issue `#83`, o frontend agora vive de fato em [frontend/](/C:/Github/clutch/frontend).

### 1. Configurar variaveis do frontend
```bash
cd frontend
cp .env.example .env.local
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Subir o app
```bash
npm run dev
```

O frontend ficara disponivel em `http://localhost:3000`.

### 4. Validar a foundation
```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Esta etapa entrega apenas a base do app: Next.js 15, TypeScript strict, Tailwind v3, aliases, shell inicial e setup de testes.

### Login local
Depois da foundation e da issue `#87`, o login do frontend fica em:

```txt
http://localhost:3000/login
```

Use a conta demo seeded no backend:

```txt
Email: clutchplayer@clutch.gg
Senha: clutch123
```

---

## 🧪 Testes

```bash
# Rodar todos os testes
npm test

# Modo watch
npm run test:watch

# Com relatório de cobertura
npm run test:coverage
```

**Threshold mínimo:** 80% de cobertura em linhas, funções e statements.

### Seed do banco

```bash
cd backend
npm run db:seed
```

O seed cria uma conta demo e dados suficientes para validar:
- perfil público
- feed social
- amizades aceitas e pendentes
- comentários
- notificações
- presença

---

## 📁 Estrutura de pastas

```
clutch/
├── .github/
│   ├── workflows/ci.yml          ← GitHub Actions CI
│   └── ISSUE_TEMPLATE/           ← Templates de issues
├── backend/
│   ├── presence-service/         ← Go (Rich Presence WebSocket)
│   ├── python-service/           ← Python (Epic Games auth)
│   ├── prisma/schema.prisma      ← Schema do banco de dados
│   └── src/
│       ├── api/routes/           ← Rotas HTTP
│       ├── api/middlewares/      ← Middlewares
│       ├── core/domain/          ← Types e interfaces
│       ├── core/repositories/    ← Acesso a dados
│       ├── core/services/        ← Regras de negócio
│       └── infra/                ← Database, Redis, integrações
├── frontend/                     ← Next.js 15
└── docker-compose.yml            ← Postgres + Redis
```

---

## 🤝 Contribuindo

Leia o [CONTRIBUTING.md](CONTRIBUTING.md) para entender o fluxo de branches, padrão de commits e como abrir PRs.

---

## 🗺️ Roadmap

| Versão | Nome | Status |
|---|---|---|
| v1.0 | Identidade | 🚧 Em desenvolvimento |
| v1.5 | Comunidade | 📋 Planejado |
| v2.0 | Universo Otaku | 📋 Planejado |
| v2.5 | Criação | 📋 Planejado |
| v3.0 | Ecossistema | 📋 Planejado |

---

## 📄 Licença

MIT © [Alessandro](https://github.com/alessandrolsdev)
