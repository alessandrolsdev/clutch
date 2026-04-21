# CLUTCH - PROJECT.md

## Escopo do documento

Este arquivo resume o estado real atual do projeto para orientar implementacao, revisao, onboarding tecnico e manutencao da documentacao.
Ele e derivado do blueprint atual, do codigo real e da validacao operacional mais recente.

Nao descreve roadmap como se ja estivesse entregue.
Nao substitui o blueprint nem o backlog.

## Estado atual real do produto

O CLUTCH hoje opera sobre um runtime principal composto por:

- frontend Next.js 15 + TypeScript
- backend Fastify + Prisma + TypeScript
- presence/realtime em Go + Redis Pub/Sub
- PostgreSQL + Redis
- Docker Compose + Traefik como topologia local principal

No estado atual, o produto ja entrega:

- landing publica
- login e registro
- shell autenticado
- feed com posts, comentarios e reacoes
- notificacoes
- perfil de usuario
- settings de perfil
- integracoes Steam, Epic, IGDB e Discord OAuth
- biblioteca do usuario em `/:username/library`
- presence real no frontend
- superficies globais de `error`, `loading` e `not-found`

## Arquitetura atual

### Frontend

- Next.js 15 App Router
- React 19
- React Query para leitura e invalidacao
- Zustand para estado global leve
- rotas server-side `/api/*` como boundary de auth e proxy para o backend

### Backend

- Fastify como servidor HTTP principal
- Prisma como camada de persistencia
- organizacao em rotas finas + services + repositories
- integracoes externas encapsuladas por provider/client especifico

### Realtime

- servico Go separado do backend principal
- autenticacao JWT para WebSocket
- Redis Pub/Sub para fan-out e sincronizacao de estado

### Infra

- Docker Compose como ambiente principal de execucao
- Traefik como proxy reverso e unica entrada publica
- service discovery por nome de container

## Runtime e topologia

Topologia atual simplificada:

```text
Browser
  -> Traefik (:80)
    -> Frontend Next.js (:3000 interno)
      -> rotas server-side /api/*
        -> Backend Fastify (:3344 interno)
    -> Presence service Go (:8080 interno)
    -> Postgres (:5432 interno)
    -> Redis (:6379 interno)
```

Premissas operacionais atuais:

- apenas Traefik expoe porta publica
- frontend, backend e presence se comunicam por rede interna
- postgres e redis nao devem ser assumidos como servicos expostos publicamente
- `python-service` existe no repositorio, mas nao participa do runtime principal

## Contratos principais

### Auth e sessao

Frontend server-side:

- `/api/auth/login`
- `/api/auth/register`
- `/api/auth/refresh`
- `/api/auth/logout`
- `/api/auth/me`
- `/api/auth/presence-token`
- `/api/[...path]`

Backend:

- `/auth`
- `/profiles`
- `/friends`
- `/posts`
- `/notifications`
- `/presence`
- `/integrations`

### Profile e library

- a fonte principal da biblioteca continua sendo `GET /profiles/:username`
- `gameLibrary` e consumido pelo perfil e por `/:username/library`
- busca, filtro e ordenacao da library continuam locais no frontend

### Presence

- token emitido via `/api/auth/presence-token`
- WebSocket consumido em `/ws/presence?token=<jwt>`
- o frontend distingue snapshot do backend e overlay realtime

## O que esta implementado

### Frontend

- library entregue e refinada
- Discord OAuth entregue ponta a ponta entre frontend e backend
- shell autenticado com navegacao real
- superficies globais de erro/loading/404
- feedback visual basico em notificacoes e amizade
- hydration resilience nos pontos principais de data/hora

### Backend

- auth com access token curto, refresh token rotativo e key rotation com `kid`
- integracoes Steam, Epic, IGDB e Discord
- query de profile sem truncamento silencioso da library
- enrichment de capas preservando `coverUrl` confiavel nas sincronizacoes
- logging estruturado e redaction basica
- fronteira backend-side de ingestao de presence Discord

### Presence

- presence token real
- lifecycle de conexao, heartbeat e fan-out
- publish de estado pelo frontend

## O que esta parcial

- a suite completa do backend ainda nao esta 100% estavel fora do ambiente ideal
- a integracao Epic continua limitada ao que o adapter atual fornece
- o enrichment automatico da Steam ainda depende do primeiro candidato retornado pelo IGDB
- parte da documentacao historica fora da `.codex` ainda pode divergir do estado atual

## O que esta sensivel

- alteracoes em auth/session exigem cuidado com ordem entre middleware, bootstrap e navegacao
- alteracoes em presence exigem cuidado com fallback entre snapshot e realtime
- alteracoes em integracoes exigem contrato honesto para timeout, indisponibilidade e dados ausentes
- o backend nao deve ser descrito como "100% saudavel" sem ressalva enquanto a suite completa continuar parcial

## O que nao deve ser assumido

- nao assumir Kafka, MongoDB ou Kubernetes no estado atual
- nao assumir um servico Python/FastAPI real no runtime principal
- nao assumir endpoints de library dedicados alem de `GET /profiles/:username`
- nao assumir que backlog estrategico ja virou feature entregue
- nao assumir que qualquer doc antiga tenha precedencia sobre o blueprint e o codigo real

## Limites atuais

- validacao completa do backend ainda depende de ambiente adequado para integracao com banco e Redis
- ha warnings remanescentes de lint em `backend/src/config/rate-limit.ts`
- o produto ainda nao deve ser planejado como se tivesse pipeline pesado de midia, mensageria sofisticada ou stack de ML operacional

## Regras de manutencao da documentacao

Hierarquia de verdade da `.codex`:

1. blueprint atual
2. codigo real
3. validacao operacional comprovada
4. documentos resumidos desta pasta

Regras:

- quando houver divergencia, corrigir a doc resumida e manter o blueprint como referencia principal
- nao promover itens parciais para "entregue" sem evidencia no codigo e na validacao
- atualizar este arquivo sempre que mudarem:
  - arquitetura de runtime
  - contratos centrais
  - topologia operacional
  - estado de implementacao do produto

## Como usar este arquivo

- use `PROJECT.md` como resumo operacional
- use o blueprint atual quando precisar de detalhe tecnico mais profundo
- use `SPRINT-NEXT.md` para o recorte de produto previsto para a proxima fase
