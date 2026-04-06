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

- [Docker + Docker Compose](https://www.docker.com)
- [Git](https://git-scm.com)
- Node.js 20+ apenas se você quiser rodar serviços fora dos containers
- Go 1.24+ apenas se você quiser rodar o `presence-service` fora dos containers

---

## 🚀 Como rodar localmente

O ambiente local agora é **container-first** e sobe por **porta única externa** via proxy reverso.  
Você não precisa mais expor `3000`, `3344`, `5432`, `6379` ou `8080` no host.

### 1. Clonar o repositório
```bash
git clone https://github.com/alessandrolsdev/clutch.git
cd clutch
```

### 2. Configurar variáveis do compose
```bash
cp .env.example .env
```

Se o host público do proxy não for `http://localhost`, defina `NEXT_PUBLIC_APP_URL` com a origem pública correta antes de subir o stack. Exemplos: túnel HTTPS, máquina remota ou cloud dev.

### 3. Subir todo o ambiente
```bash
docker compose up --build
```

O backend agora reaproveita o volume de `node_modules` e só sincroniza dependências ou Prisma quando detecta drift real no runtime.
O seed demo deixou de rodar em todo restart para reduzir custo operacional e evitar efeitos colaterais desnecessários.

O compose sobe:
- `traefik` na porta `80`
- `frontend` internamente na `3000`
- `backend` internamente na `3344`
- `presence` internamente na `8080`
- `postgres` internamente na `5432`
- `redis` internamente na `6379`

Todos os serviços se comunicam por nome Docker (`frontend`, `backend`, `presence`, `postgres`, `redis`).

### 4. Acessar o app

- Frontend: `http://localhost`
- Login: `http://localhost/login`
- Backend health via frontend proxy: `http://localhost/api/health`
- Backend liveness via frontend proxy: `http://localhost/api/health/live`
- Backend readiness via frontend proxy: `http://localhost/api/health/ready`
- Presence health via proxy: `http://localhost/presence/health`

### 5. Bootstrap dos dados demo

Depois da primeira subida, carregue a base demo explicitamente:

```bash
docker compose exec backend sh ./scripts/container-bootstrap.sh
```

Esse comando:
- aplica migrations pendentes
- popula a conta demo e os dados sociais determinísticos

Você pode reexecutá-lo quando quiser restaurar a base demo sem depender do restart do container.

### Comandos operacionais recomendados

O repositório agora expõe uma interface mínima na raiz para operar o ambiente local:

```bash
npm run env:bootstrap
npm run env:validate
npm run env:reset
```

- `env:bootstrap` — sobe o stack com build e executa o bootstrap do backend
- `env:validate` — verifica serviços em execução, health endpoints e um fluxo mínimo de auth via proxy
- `env:reset` — derruba o stack e remove volumes nomeados do compose para recomeço limpo

Use `env:reset` quando houver drift local relevante de banco, Redis ou caches de containers. Para o fluxo normal, prefira `env:bootstrap` seguido de `env:validate`.

### 6. Conta demo

O seed é determinístico e pode ser reexecutado sem depender de Steam, IGDB, Epic ou Discord.

```txt
Email: clutchplayer@clutch.gg
Senha: clutch123
```

---

## Validação rápida do ambiente

### Health do backend
```bash
curl http://localhost/api/health
```

### Liveness e readiness do backend
```bash
curl http://localhost/api/health/live
curl http://localhost/api/health/ready
```

### Health do presence
```bash
curl http://localhost/presence/health
```

### Login via frontend proxy
```bash
docker compose exec backend sh ./scripts/container-bootstrap.sh

curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"clutchplayer@clutch.gg","password":"clutch123"}'
```

### Presença em tempo real
O browser conecta o WebSocket pelo mesmo host público:

```txt
ws://localhost/ws/presence?token=<jwt>
```

O token continua vindo da rota local autenticada do frontend.

### Readiness do stack
- `backend` fica saudável quando banco e Redis respondem em `/health/ready`
- `frontend` fica saudável quando `http://127.0.0.1:3000/login` responde no container
- `traefik` só sobe como healthy depois do ping interno e das dependências saudáveis

### Desenvolvimento manual fora de containers
Ainda é possível rodar serviços manualmente, mas esse fluxo deixou de ser o padrão.  
O caminho recomendado para DX local agora é sempre `docker compose up --build`.

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
└── docker-compose.yml            ← Traefik + frontend + backend + presence + postgres + redis
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
