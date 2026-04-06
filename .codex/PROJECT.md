# CLUTCH — PROJECT.md

## Escopo deste documento

Este arquivo registra o estado real atual do repositorio para orientar implementacao, revisao e manutencao. Ele nao descreve roadmap como se ja estivesse entregue.

## Estado atual do produto

### Implementado
- Frontend Next.js com shell autenticado, landing publica simples, login, registro, feed, notificacoes, settings e perfil publico
- Backend Fastify com auth, profiles, friends, posts, notifications, presence e integrations
- Presence service em Go com autenticacao JWT e endpoint WebSocket em `/ws/presence`
- Stack local container-first via `docker-compose.yml` e proxy reverso Traefik
- Fluxo completo de sessao:
  - access token curto
  - refresh token rotativo em cookie httpOnly
  - revogacao de sessao atual
  - key rotation com `kid`
  - validacao de `iss`, `aud` e `nbf`
  - rate limit no auth path
- Observabilidade estruturada no auth path e gate de seguranca para logs
- Comandos locais de DX:
  - `npm run env:bootstrap`
  - `npm run env:reset`
  - `npm run env:validate`

### Parcial
- Frontend do produto ainda nao cobre todas as telas e estados previstos nas issues abertas
- Integracoes do frontend cobrem Steam, Epic e busca IGDB, mas Discord continua fora do contrato real atual
- Documentacao secundaria do repositorio pode exigir alinhamento adicional fora do escopo deste arquivo

### Ausente
- Pagina `/<username>/library`
- App Router global com `error.tsx`, `loading.tsx` e `not-found.tsx`
- Discord OAuth end-to-end
- Uso do `python-service` no stack local atual

## Arquitetura runtime atual

### Stack local
- `traefik` exposto na porta `80`
- `frontend` Next.js 15 servido internamente na `3000`
- `backend` Fastify servido internamente na `3344`
- `presence` Go servido internamente na `8080`
- `postgres` e `redis` internos ao compose

### Topologia
- Browser fala com o host publico unico
- Frontend server-side fala com o backend por `INTERNAL_API_URL`
- Realtime usa `/api/auth/presence-token` para obter JWT e conecta em `/ws/presence`

## Auth e sessao no estado atual

### Backend
- Assinatura JWT com `HS256`
- Access token com TTL curto
- Refresh token com TTL mais longo
- Key rotation com conjunto de chaves versionadas e `kid`
- Compatibilidade temporaria para tokens legados sem `kid` ou sem claims adicionais, enquanto a janela operacional permitir

### Frontend
- `clutch_session` guarda o access token como cookie httpOnly
- `clutch_refresh` e gerenciado pelo backend e propagado pelo frontend server-side
- Rotas server-side de auth fazem refresh transparente em `401` onde isso faz sentido

## Contratos atuais relevantes

### Rotas server-side do frontend
- `/api/auth/login`
- `/api/auth/register`
- `/api/auth/refresh`
- `/api/auth/logout`
- `/api/auth/me`
- `/api/auth/presence-token`
- `/api/[...path]`

### Rotas principais do backend
- `/auth`
- `/profiles`
- `/friends`
- `/presence`
- `/integrations`
- `/posts`
- `/notifications`

### Presence
- Health: `/presence/health` via proxy
- WebSocket: `/ws/presence?token=<jwt>`

## Estado do frontend

### Entregue
- Shell com grupos `(auth)` e `(app)`
- Navbar, sidebar, providers e stores de auth/presence
- Consumidores reais de feed, notificacoes, perfil e integracoes
- Fluxo de auth server-side e proxy ao backend

### Nao entregue
- Biblioteca publica do usuario
- Discord connect no frontend
- Superficie global completa de erro/loading/not-found

## Operacao local

Fluxo recomendado hoje:

```bash
npm run env:bootstrap
npm run env:validate
```

Reset destrutivo:

```bash
npm run env:reset
```

`env:reset` apaga volumes nomeados e destrói o estado local de banco e Redis. Ele existe para recomeço limpo e eliminacao de drift.

## Limites e premissas

- O repositório contem artefatos e referencias historicas que nao fazem parte do runtime local principal.
- O backend expõe mais superficie do que o frontend consome hoje.
- Este arquivo deve ser atualizado sempre que contratos de auth, session, realtime, stack local ou superficie de frontend mudarem.
