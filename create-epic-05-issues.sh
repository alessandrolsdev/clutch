#!/bin/bash
# ============================================================
# CLUTCH ⚡ — Criar issues da EPIC-05 via GitHub CLI
# Execute na raiz do repositório: bash create-epic-05-issues.sh
# ============================================================

set -e

REPO="alessandrolsdev/clutch"
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}⚡ CLUTCH — Criando issues da EPIC-05${NC}"
echo ""

# ── EPIC-05 ───────────────────────────────────────────────────
echo -e "${YELLOW}[1/7]${NC} Criando EPIC-05..."
gh issue create \
  --repo "$REPO" \
  --title "[EPIC-05] ⚡ Rich Presence e WebSocket" \
  --label "epic,feature,v1.0" \
  --body "## 🎯 Objetivo
Implementar o sistema de Rich Presence — a feature mais diferenciada do CLUTCH.
Usuários veem em tempo real o que seus amigos estão jogando, em qual plataforma e com qual detalhe da partida.

---

## 🏗️ Arquitetura

\`\`\`
Cliente
  │
  ├── REST ──► Node.js Fastify (:3333)
  │                 │
  │            Redis Pub/Sub
  │                 │
  └── WebSocket ──► Go Service (:8080)
                        │
                    Hub (goroutines)
                    map[userId]*Client
\`\`\`

---

## 📦 Issues filhas
- [ ] #41 — \`presence.repository.ts\` (dual-layer Redis + Postgres)
- [ ] #42 — \`POST /presence\` e \`GET /presence/:userId\`
- [ ] #43 — Go service: \`hub.go\` + \`main.go\`
- [ ] #44 — Integração Discord Bot → UserPresence
- [ ] #45 — Testes unitários do \`presence.repository\`
- [ ] #46 — Testes de integração das rotas de presença

---

## ✅ Critério de aceite
- [ ] Cliente conecta via WebSocket e aparece como ONLINE
- [ ] Ao iniciar jogo, status muda para IN_GAME com nome do jogo
- [ ] Amigos recebem update em tempo real com latência < 500ms
- [ ] Desconexão marca usuário como OFFLINE automaticamente
- [ ] Presença persiste no Redis com TTL de 5 minutos"

echo -e "${GREEN}✅ EPIC-05 criada${NC}"

# ── Issue #41 ─────────────────────────────────────────────────
echo -e "${YELLOW}[2/7]${NC} Criando issue #41..."
gh issue create \
  --repo "$REPO" \
  --title "feat(presence): implementar presence.repository.ts" \
  --label "feature,v1.0" \
  --body "## 🎯 Objetivo
Implementar o repositório de presença com dual-layer:
Redis para velocidade (TTL 5 min) e Postgres para persistência.

---

## 🏗️ Dual-layer

\`\`\`
SET presence ──► Redis (TTL 5min)  ← leitura rápida
              └► Postgres          ← persistência e histórico
\`\`\`

---

## 📐 Interface

\`\`\`typescript
presenceRepository.set(userId, data)            // atualiza Redis + Postgres
presenceRepository.get(userId)                  // lê Redis, fallback Postgres
presenceRepository.setOffline(userId)           // remove Redis + OFFLINE no Postgres
presenceRepository.getFriendsPresence(userIds)  // bulk get do Redis
\`\`\`

---

## 📝 Tasks
- [ ] Implementar \`src/infra/cache/redis.ts\`
- [ ] Implementar \`src/core/repositories/presence.repository.ts\`
- [ ] Chave Redis: \`presence:{userId}\` com TTL de 300s
- [ ] Publicar no canal \`presence:updates\` após cada SET

## 🌿 Branch
\`feature/rich-presence\`

## ✅ Critério de aceite
- [ ] SET atualiza Redis e Postgres atomicamente
- [ ] GET lê Redis primeiro, fallback para Postgres
- [ ] TTL expirado → usuário aparece como OFFLINE
- [ ] Publicação no Pub/Sub ocorre após cada atualização"

echo -e "${GREEN}✅ Issue #41 criada${NC}"

# ── Issue #42 ─────────────────────────────────────────────────
echo -e "${YELLOW}[3/7]${NC} Criando issue #42..."
gh issue create \
  --repo "$REPO" \
  --title "feat(presence): implementar rotas REST de presença" \
  --label "feature,v1.0" \
  --body "## 🎯 Objetivo
Endpoints REST para atualizar e consultar presença de usuários.
O Discord Bot e outros clientes usam estes endpoints para reportar status.

---

## 📐 Especificação da API

### \`POST /presence\` — Atualizar presença

**Headers:** \`x-user-id: <userId>\`

**Body:**
\`\`\`json
{
  \"status\":      \"ONLINE | IN_GAME | AFK | OFFLINE\",
  \"currentGame\": \"string (opcional)\",
  \"gameDetails\": \"object (opcional)\",
  \"platform\":    \"string (opcional)\"
}
\`\`\`

**Respostas:**

| Status | Quando |
|---|---|
| \`200 OK\` | Presença atualizada |
| \`400 Bad Request\` | Body inválido |
| \`401 Unauthorized\` | Header ausente |

---

### \`GET /presence/:userId\` — Consultar presença

**Respostas:**

| Status | Quando |
|---|---|
| \`200 OK\` | \`{ status, currentGame, platform, updatedAt }\` |
| \`404 Not Found\` | Usuário não existe |

---

## 📝 Tasks
- [ ] Criar \`src/api/routes/presence.routes.ts\`
- [ ] Registrar no \`server.ts\` com prefix \`/presence\`
- [ ] Publicar update no Redis Pub/Sub após POST

## 🌿 Branch
\`feature/rich-presence\`

## ✅ Critério de aceite
- [ ] POST atualiza presença e publica no Redis
- [ ] GET retorna presença atual
- [ ] 401 sem header x-user-id
- [ ] 400 com status inválido"

echo -e "${GREEN}✅ Issue #42 criada${NC}"

# ── Issue #43 ─────────────────────────────────────────────────
echo -e "${YELLOW}[4/7]${NC} Criando issue #43..."
gh issue create \
  --repo "$REPO" \
  --title "feat(presence): implementar Go service (hub.go + main.go)" \
  --label "feature,v1.0" \
  --body "## 🎯 Objetivo
Serviço Go responsável por gerenciar conexões WebSocket em escala.
Cada cliente conectado recebe updates de presença dos seus amigos em tempo real.

---

## 🏗️ Arquitetura interna

\`\`\`
main.go
  └── HTTP server :8080
        ├── GET /ws/presence?userId=xxx  ← upgrade WebSocket
        └── GET /stats                   ← conexões ativas

hub.go
  └── Hub struct
        ├── clients: map[string]*Client
        ├── register/unregister channels
        └── broadcast goroutine
              └── subscreve Redis channel \"presence:updates\"
                  └── entrega para clientes relevantes
\`\`\`

---

## 📨 Protocolo WebSocket

**Cliente → Servidor:**
\`\`\`json
{ \"event\": \"PING\" }
{ \"event\": \"PRESENCE_UPDATE\", \"payload\": { ... } }
\`\`\`

**Servidor → Cliente:**
\`\`\`json
{ \"event\": \"FRIEND_PRESENCE\", \"payload\": { \"userId\", \"status\", \"currentGame\" }, \"ts\": 0 }
{ \"event\": \"PONG\", \"ts\": 0 }
\`\`\`

---

## 📝 Tasks
- [ ] Implementar \`backend/presence-service/hub.go\`
- [ ] Implementar \`backend/presence-service/main.go\`
- [ ] Configurar \`go.mod\` com dependências (gorilla/websocket, go-redis)
- [ ] Atualizar \`docker-compose.yml\` com serviço presence

## 🌿 Branch
\`feature/rich-presence\`

## ✅ Critério de aceite
- [ ] \`go run .\` sobe sem erros na porta 8080
- [ ] Cliente conecta via WebSocket
- [ ] Update de presença chega em < 500ms via Redis Pub/Sub
- [ ] \`GET /stats\` retorna número de conexões ativas"

echo -e "${GREEN}✅ Issue #43 criada${NC}"

# ── Issue #44 ─────────────────────────────────────────────────
echo -e "${YELLOW}[5/7]${NC} Criando issue #44..."
gh issue create \
  --repo "$REPO" \
  --title "feat(presence): integração Discord Bot → UserPresence" \
  --label "feature,v1.0" \
  --body "## 🎯 Objetivo
O Discord Bot detecta quando um usuário começa ou para de jogar
e atualiza automaticamente o UserPresence via REST API.

---

## 🏗️ Fluxo

\`\`\`
Discord presenceUpdate event
        ↓
Bot detecta activities do usuário
        ↓
Identifica se é um jogo (type === 0)
        ↓
POST /presence com status IN_GAME + gameName
        ↓
Redis Pub/Sub notifica o Go service
        ↓
Amigos recebem update via WebSocket
\`\`\`

---

## 📝 Tasks
- [ ] Criar \`src/infra/integrations/discord/discord.service.ts\`
- [ ] Listener de \`presenceUpdate\` no bot
- [ ] Mapear \`discordId\` → \`userId\` via \`PlatformIntegration\`
- [ ] Chamar \`POST /presence\` internamente ao detectar jogo

## 🌿 Branch
\`feature/rich-presence\`

## ✅ Critério de aceite
- [ ] Iniciar jogo no Discord atualiza presença no CLUTCH
- [ ] Parar de jogar retorna status para ONLINE
- [ ] Usuário sem integração Discord é ignorado silenciosamente
- [ ] Erros do Discord não derrubam o servidor principal"

echo -e "${GREEN}✅ Issue #44 criada${NC}"

# ── Issue #45 ─────────────────────────────────────────────────
echo -e "${YELLOW}[6/7]${NC} Criando issue #45..."
gh issue create \
  --repo "$REPO" \
  --title "test(presence): testes unitários do presence.repository" \
  --label "test,v1.0" \
  --body "## 🎯 Objetivo
Garantir que o presence.repository funciona corretamente com Redis e Postgres mockados.

---

## 🧪 Cenários a cobrir

### \`set\`
- [ ] Salva no Redis com TTL correto (300s)
- [ ] Atualiza Postgres via upsert
- [ ] Publica no canal Redis Pub/Sub \`presence:updates\`

### \`get\`
- [ ] Retorna dados do Redis quando disponível
- [ ] Faz fallback para Postgres quando Redis miss
- [ ] Retorna status OFFLINE quando não encontrado em nenhum layer

### \`setOffline\`
- [ ] Remove chave do Redis
- [ ] Atualiza status para OFFLINE no Postgres

### \`getFriendsPresence\`
- [ ] Retorna presença de múltiplos usuários em bulk via Redis pipeline

## 🌿 Branch
\`feature/rich-presence\`

## ✅ Critério de aceite
- [ ] Redis completamente mockado (ioredis mock)
- [ ] Prisma completamente mockado
- [ ] Cobertura ≥ 80%"

echo -e "${GREEN}✅ Issue #45 criada${NC}"

# ── Issue #46 ─────────────────────────────────────────────────
echo -e "${YELLOW}[7/7]${NC} Criando issue #46..."
gh issue create \
  --repo "$REPO" \
  --title "test(presence): testes de integração das rotas de presença" \
  --label "test,v1.0" \
  --body "## 🎯 Objetivo
Cobrir todos os endpoints de presença com testes de integração usando Fastify inject.

---

## 🧪 Cenários a cobrir

### \`POST /presence\`
- [ ] 200 atualizando para ONLINE
- [ ] 200 atualizando para IN_GAME com currentGame
- [ ] 200 atualizando para AFK
- [ ] 400 com status inválido
- [ ] 401 sem header x-user-id

### \`GET /presence/:userId\`
- [ ] 200 com presença atual
- [ ] 404 quando usuário não existe

## 🌿 Branch
\`feature/rich-presence\`

## ✅ Critério de aceite
- [ ] presence.repository completamente mockado
- [ ] Todos os cenários cobertos
- [ ] CI passa com cobertura ≥ 80%"

echo -e "${GREEN}✅ Issue #46 criada${NC}"

# ── Resumo ────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅ EPIC-05 completa — 7 issues criadas!${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  📌 Próximo passo:"
echo "     git checkout -b feature/rich-presence"
echo ""
