# Frontend Context

## Objetivo

Este arquivo descreve o estado real atual do frontend do CLUTCH, os contratos que ele consome hoje e as limitacoes conhecidas. Ele nao deve ser usado como roadmap.

## Modelo atual do frontend

- Framework: Next.js 15 com App Router
- Runtime principal: container-first dentro do compose
- Papel do frontend:
  - renderizar a UI
  - manter a sessao do usuario via rotas server-side
  - fazer proxy para o backend
  - emitir token de presence para o browser abrir o WebSocket

## Rotas publicas e autenticadas existentes

### Publicas
- `/`
- `/login`
- `/register`
- `/offline`

### Autenticadas
- `/feed`
- `/notifications`
- `/settings`
- `/settings/integrations`
- `/settings/integrations/discord/callback`
- `/arena`
- `/:username`
- `/:username/library`

### Superficies globais do App Router
- `error.tsx`
- `loading.tsx`
- `not-found.tsx`

## Rotas server-side internas

### Auth
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/presence-token`
- `GET /api/auth/accounts/[provider]/link/callback`
- `GET /api/auth/accounts/[provider]/reauth/callback`

### Proxy
- `GET|POST|PUT|PATCH|DELETE /api/[...path]`

Esse catch-all encaminha chamadas para o backend real e, quando existe `clutch_session`, injeta `Authorization: Bearer <access_token>` server-side.

## Sessao e cookies

### Cookies atuais
- `clutch_session`
  - access token
  - cookie httpOnly
  - controlado pelo frontend server-side
- `clutch_refresh`
  - refresh token
  - cookie httpOnly
  - emitido pelo backend e propagado pelo frontend server-side

### Comportamento atual
- login e registro recebem `token` do backend, gravam `clutch_session` e propagam `clutch_refresh`
- `/api/auth/me` tenta restaurar a sessao; se o access token expirou, tenta refresh antes de falhar
- `/api/auth/presence-token` segue a mesma logica de refresh antes de devolver o token ao browser
- `/api/auth/refresh` renova os dois cookies
- `/api/auth/logout` limpa cookies locais e propaga o logout/revogacao ao backend

## Contratos backend que o frontend consome hoje

### Auth
- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

### Produto
- `GET /profiles/:username`
- `PATCH /profiles/:username`
- `GET /friends/:userId`
- `GET /friends/requests/:userId`
- `POST /friends/request/:targetId`
- `POST /friends/accept/:requestId`
- `DELETE /friends/:friendId`
- `GET /posts/feed/:userId`
- `POST /posts`
- `POST /posts/:id/interactions`
- `POST /posts/comments`
- `GET /posts/comments/:postId`
- `DELETE /posts/:id`
- `GET /notifications/:userId`
- `PATCH /notifications/read-all`
- `PATCH /notifications/:id/read`
- `POST /integrations/steam/connect`
- `POST /integrations/steam/sync`
- `POST /integrations/epic/connect`
- `GET /integrations/igdb/search`
- `GET /integrations/discord/auth`
- `GET /integrations/discord/callback`
- `GET /auth/connected-accounts`
- `PATCH /auth/connected-accounts/:provider/visibility`
- `GET /auth/accounts/:provider/link/start`
- `GET /auth/accounts/:provider/link/callback`
- `DELETE /auth/accounts/:provider`
- `GET /auth/accounts/:provider/reauth/start`
- `GET /auth/accounts/:provider/reauth/callback`
- `GET /arena/challenges`
- `GET /arena/challenges/:slug`
- `POST /arena/challenges/:challengeId/join`
- `POST /arena/challenges/:challengeId/submissions`
- `GET /arena/challenges/:challengeId/leaderboard`

### Observacao importante
- o frontend usa Discord OAuth real via backend, mas nao consome diretamente a rota interna de ingestao de presence Discord
- a presence do browser continua chegando pela API do CLUTCH e pelo WebSocket do proprio produto

## Resolucao de URLs

### Variaveis relevantes
```env
INTERNAL_API_URL=http://backend:3344
NEXT_PUBLIC_APP_URL=http://localhost
NEXT_PUBLIC_API_URL=/api
```

### Politica atual
- server-side usa `INTERNAL_API_URL` quando definido
- browser e helpers publicos usam a origem publica do app
- `NEXT_PUBLIC_API_URL=/api` mantem a API publica no mesmo host do proxy
- `NEXT_PUBLIC_WS_URL` e opcional; se ausente, o frontend deriva `ws://` ou `wss://` da origem publica

## Realtime atual

### Fluxo
1. o browser chama `GET /api/auth/presence-token`
2. a rota server-side valida ou renova a sessao
3. a resposta devolve `{ token }`
4. o client abre `ws://<host>/ws/presence?token=<jwt>`
5. o hook `usePresence` atualiza a store e limpa a sessao se houver falha de auth

### Comportamento atual
- o frontend combina snapshot vindo do backend com overlay realtime da store
- shell, perfil e lista de amigos distinguem realtime ativo, reconexao e fallback para snapshot

### Dependencia atual
O presence service aceita token por query string e por header `Authorization`, mas o frontend atual usa query string.

## Dependencias operacionais do frontend

- backend saudavel e acessivel por `INTERNAL_API_URL`
- presence service acessivel pelo host publico do proxy
- Redis e PostgreSQL disponiveis para o backend
- stack recomendado via `docker-compose.yml`

## Limitacoes reais

### Implementado parcialmente
- a UI de landing publica continua simples
- varias paginas existem e consomem contratos reais, mas a cobertura funcional do produto ainda nao esta completa

### Sensivel
- auth e refresh exigem cuidado com a ordem entre middleware, bootstrap e navegacao
- presence exige cuidado com fallback entre snapshot e realtime
- integracoes dependem de indisponibilidade e dados ausentes serem tratados com honestidade

### Nao assumir
- nao assumir que `python-service` participe do runtime do frontend
- nao assumir endpoints fora dos listados acima
- nao assumir que o frontend possa acessar refresh token diretamente no browser
