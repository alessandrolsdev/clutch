# CLUTCH

CLUTCH e um projeto web com frontend Next.js, backend Fastify, service de presence em Go e stack local container-first com proxy reverso por porta unica.

Este README descreve apenas o que esta confirmado no codigo atual.

## Estado atual

### Implementado
- Stack local container-first com `traefik`, `frontend`, `backend`, `presence`, `postgres` e `redis`
- Fluxo de autenticacao com login, registro, access token curto, refresh token em cookie httpOnly e logout
- Renovacao de sessao server-side no frontend
- Revogacao de sessao baseada em refresh token
- JWT com `HS256`, `kid`, key rotation, `iss`, `aud`, `nbf` e validacao estrita
- Rate limit nos endpoints de autenticacao
- Logging estruturado e gate de seguranca para logs no CI
- Rich presence via WebSocket autenticado por token
- Rotas de frontend para feed, notificacoes, perfil publico e settings/integrations
- Comandos operacionais locais `env:bootstrap`, `env:reset` e `env:validate`

### Parcial
- Frontend do produto: existe shell autenticado e paginas principais, mas nem todas as issues de UX e cobertura de paginas foram entregues
- Integracoes no frontend: Steam, Epic e busca IGDB estao conectadas ao contrato real; Discord aparece como limitacao real no proprio frontend
- Documentacao secundaria do repositorio pode ainda ter drift fora deste arquivo

### Ausente
- Rota/pagina `/<username>/library`
- Arquivos globais `error.tsx`, `loading.tsx` e `not-found.tsx` no App Router
- Fluxo de Discord OAuth no frontend e no backend
- Qualquer garantia de que `python-service` faca parte do runtime local atual; ele nao participa do `docker-compose.yml`

## Arquitetura atual

| Camada | Tecnologia | Papel no runtime atual |
|---|---|---|
| Proxy | Traefik v3 | Porta externa unica `:80` |
| Frontend | Next.js 15 | UI, API routes internas e proxy server-side |
| Backend | Fastify 5 + TypeScript | API principal, auth, feed, perfil, notificacoes e integracoes |
| Presence | Go + Gorilla WebSocket | WebSocket de presence autenticado |
| Banco | PostgreSQL 15 | Persistencia principal |
| Cache | Redis 7 | Sessao de refresh, presence e rate limiting |

### Topologia local
- Host publico local: `http://localhost`
- API via proxy: `http://localhost/api/*`
- Presence health via proxy: `http://localhost/presence/health`
- WebSocket de presence via host publico: `ws://localhost/ws/presence?token=<jwt>`

## Como rodar localmente

### Pre-requisitos
- Docker Desktop ou Docker Engine com Compose
- Git
- Node.js 20+ apenas se voce quiser executar os comandos de raiz fora dos containers

### Variaveis do compose
Crie `.env` na raiz a partir do exemplo:

```bash
cp .env.example .env
```

Valores usados hoje:

```env
POSTGRES_PASSWORD=clutch_dev_pass
JWT_SECRET=clutch-dev-secret-change-in-production
```

### Fluxo recomendado
O fluxo operacional recomendado hoje e:

```bash
npm run env:bootstrap
npm run env:validate
```

#### `npm run env:bootstrap`
- sobe o stack com `docker compose up -d --build`
- executa `backend/scripts/container-bootstrap.sh`
- aplica migrations e seed demo no backend

#### `npm run env:validate`
- verifica se os servicos essenciais estao em execucao
- valida `GET /api/health`
- valida `GET /presence/health`
- executa um fluxo minimo de auth via proxy:
  - login
  - `GET /api/auth/me`
  - `GET /api/auth/presence-token`
  - logout

#### `npm run env:reset`
- derruba o stack
- remove volumes nomeados do compose

`env:reset` e destrutivo para o estado local. Ele apaga o estado de banco e Redis e deve ser usado quando voce quiser recomeçar o ambiente do zero ou eliminar drift local relevante.

## URLs e health checks

- App: `http://localhost`
- Login: `http://localhost/login`
- API health: `http://localhost/api/health`
- API liveness: `http://localhost/api/health/live`
- API readiness: `http://localhost/api/health/ready`
- Presence health: `http://localhost/presence/health`

## Conta demo

Depois do bootstrap:

```txt
Email: clutchplayer@clutch.gg
Senha: clutch123
```

## Auth, sessao e realtime

### Auth atual
- `POST /api/auth/login` autentica via frontend server-side
- `POST /api/auth/register` registra e inicia sessao
- `POST /api/auth/refresh` renova a sessao via refresh token
- `POST /api/auth/logout` encerra sessao e revoga o refresh atual
- `GET /api/auth/me` restaura a sessao do usuario autenticado

### Cookies atuais
- `clutch_session`: access token em cookie httpOnly gerenciado pelo frontend server-side
- `clutch_refresh`: refresh token em cookie httpOnly emitido pelo backend

### Realtime atual
- o browser nao usa o refresh token diretamente
- o frontend chama `GET /api/auth/presence-token`
- a rota server-side valida/renova a sessao, devolve um JWT e o browser abre o WebSocket com `?token=...`

## Superficie funcional atual

### Backend
Rotas principais confirmadas no codigo:
- `/auth`
- `/profiles`
- `/friends`
- `/presence`
- `/integrations`
- `/posts`
- `/notifications`

### Frontend
Rotas App Router confirmadas no codigo:
- `/`
- `/login`
- `/register`
- `/feed`
- `/notifications`
- `/settings`
- `/settings/integrations`
- `/:username`

Rotas server-side internas confirmadas no codigo:
- `/api/auth/login`
- `/api/auth/register`
- `/api/auth/refresh`
- `/api/auth/logout`
- `/api/auth/me`
- `/api/auth/presence-token`
- `/api/[...path]` para proxy ao backend

## Configuracao de host publico

O frontend separa URL interna do backend e origem publica do proxy:

```env
INTERNAL_API_URL=http://backend:3344
NEXT_PUBLIC_APP_URL=http://localhost
NEXT_PUBLIC_API_URL=/api
```

Regras atuais:
- `INTERNAL_API_URL` e usada no server-side para falar com o backend dentro do compose
- `NEXT_PUBLIC_APP_URL` define a origem publica do app/proxy
- `NEXT_PUBLIC_API_URL=/api` mantem o browser preso ao mesmo host publico

Se o host publico nao for `http://localhost`, ajuste `NEXT_PUBLIC_APP_URL` para a origem real antes de subir o stack.

## Estrutura relevante do repositorio

```txt
clutch/
├── backend/
│   ├── src/
│   ├── presence-service/
│   └── python-service/
├── frontend/
│   └── src/
├── scripts/dev/
├── infra/traefik/
├── docker-compose.yml
└── .codex/PROJECT.md
```

## Limites conhecidos

- O frontend ainda nao cobre todas as telas previstas no backlog.
- O runtime local padrao e container-first; fluxos fora de container nao sao a referencia principal da documentacao.
- `python-service` existe no repositorio, mas nao faz parte do stack do `docker-compose.yml` atual.

## Licenca

MIT. Consulte [LICENSE](LICENSE).
