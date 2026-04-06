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

### Autenticadas
- `/feed`
- `/notifications`
- `/settings`
- `/settings/integrations`
- `/:username`

### Ausentes no App Router atual
- `/:username/library`
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
- `GET /integrations/igdb/search`
- `POST /integrations/epic/connect`

### Observacao importante
O frontend atual nao depende de um endpoint de Discord connect porque esse contrato nao existe no backend atual. A UI de integracoes ja reconhece isso como limitacao real.

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
5. o hook `usePresence` atualiza o store e limpa a sessao se houver falha de auth

### Dependencia atual
O presence service aceita token por query string e por header `Authorization`, mas o frontend atual usa query string.

## Dependencias operacionais do frontend

- backend saudavel e acessivel por `INTERNAL_API_URL`
- presence service acessivel pelo host publico do proxy
- Redis e PostgreSQL disponiveis para o backend
- stack recomendado via `docker-compose.yml`

## Limitacoes reais

### Implementado parcialmente
- a UI de landing publica e simples
- varias paginas existem e consomem contratos reais, mas a cobertura funcional do produto ainda nao esta completa

### Ausente
- biblioteca publica do usuario
- Discord OAuth
- tela global de erro/loading/404 no App Router

### Nao assumir
- nao assumir que `python-service` participe do runtime do frontend
- nao assumir endpoints fora dos listados acima
- nao assumir que o frontend possa acessar refresh token diretamente no browser
