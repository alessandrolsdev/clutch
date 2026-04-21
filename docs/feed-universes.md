# Feed por Universos - Definicao minima

## Escopo

Este documento consolida a definicao minima de "feed por universos" para o CLUTCH com base no codigo real atual.

Nao implementa a feature.
Nao introduz endpoint, filtro ou contrato em producao.
Serve para limitar escopo e destravar uma issue futura pequena e revisavel.

## Fontes de verdade usadas

- `backend/src/api/routes/posts.routes.ts`
- `backend/src/core/repositories/post.repository.ts`
- `backend/src/api/routes/profile.routes.ts`
- `backend/src/core/repositories/profile.repository.ts`
- `backend/prisma/schema.prisma`
- `frontend/src/schemas/feed.ts`
- `frontend/src/schemas/profile.ts`
- `frontend/src/components/feed/feed-page-content.tsx`
- `frontend/src/components/feed/create-post-form.tsx`
- `frontend/src/components/feed/post-card.tsx`
- `frontend/src/components/profile/game-library-preview.tsx`
- `frontend/src/components/profile/platform-badges.tsx`

## Diagnostico do estado atual

### O que o feed conhece hoje

O contrato atual do feed exposto ao frontend contem:

- `type`: `TEXT`, `IMAGE`, `ACHIEVEMENT`, `GAME_SESSION`
- `gameContext`: `gameName`, `platform`, `capturedAt`
- autor, contadores, `createdAt`, `contentText` e `mediaUrl`

O backend cria `gameContext` apenas quando o usuario publica um post enquanto a presence esta em `IN_GAME`.
O feed atual nao possui:

- `universe`
- `universeId`
- `universeKey`
- tags
- generos
- franquias
- interesses declarados no perfil
- filtro server-side por universo

### O que o perfil conhece hoje

O contrato de `GET /profiles/:username` expoe:

- `platformIntegrations`
- `gameLibrary`
- `presence.currentGame`
- `presence.platform`

Isso ajuda a entender o repertorio gamer do usuario, mas nao cria por si so um contrato de universo para o feed.

### O que existe apenas como capacidade latente

Os enums de plataforma incluem `ANILIST` e `MYANIMELIST`, mas o repositorio nao expoe watchlists, catalogo anime/manga nem interesse tematico nesses contratos atuais.

Conclusao: hoje o produto sustenta bem um feed social gamer com contexto de jogo, mas ainda nao sustenta "feed por universos" como superficie confiavel sem contrato adicional.

## Definicao de produto

### O que conta como universo no CLUTCH

Universo e uma superficie social agrupadora baseada em um contexto tematico compartilhado entre jogadores.

Para ser tratado como universo no produto, o agrupador precisa:

- ser legivel para o usuario
- ter relacao direta com conteudo real do feed
- ter chave minimamente estavel
- nao depender de inferencia editorial arbitraria no frontend

### Exemplos validos

- posts ligados ao mesmo jogo quando o jogo esta explicitamente identificado
- no futuro, posts ligados a um mesmo fandom anime/manga se existir contrato proprio para isso

### Exemplos invalidos

- `PostType` sozinho
- plataforma sozinha (`Steam`, `Epic`, `Discord`)
- qualquer tema inferido sem dado explicito no payload
- generos ou franquias sem modelagem real

### Relacao entre jogo, fandom, plataforma e universo

- jogo pode ser universo
- fandom pode virar universo, mas hoje ainda nao ha contrato
- plataforma nao e universo; e uma faceta secundaria
- tipo de post nao e universo; e modalidade de publicacao

## Taxonomia minima proposta

### 1. Universo de jogo

Primeiro e unico universo que faz sentido como alvo real de curto prazo.

Definicao:

- agrupamento por titulo de jogo explicitamente presente no post
- fonte principal candidata: `post.gameContext.gameName`

Justificativa:

- e o unico sinal tematico realmente presente no feed atual
- ja conversa com a library, presence e integracoes gamer
- permite um vertical slice pequeno sem puxar catalogo externo inteiro

### 2. Universo de fandom externo

Reservado para fase futura.

Exemplos:

- anime
- manga
- outras superficies otaku

Status atual:

- bloqueado por ausencia de contrato de watchlist, catalogo ou vinculacao de consumo

### 3. Facetas que nao devem virar universo

- plataforma
- tipo de post
- estado de presence

Esses sinais podem ajudar a ordenar ou enriquecer leitura, mas nao devem ser promovidos a universo.

## Mapeamento com a arquitetura atual

### O que ja e possivel com o codigo atual

- reforcar leitura gamer no feed com `type` e `gameContext`
- destacar posts de sessao e conquista por jogo
- usar `gameLibrary` e `platformIntegrations` como contexto do perfil
- inferir localmente candidatos de universo a partir de `gameContext.gameName` para analise ou prototipo interno

### O que ainda nao e suficiente para uma feature real

- `gameContext.gameName` e apenas texto livre, sem identificador canonico
- nem todo post carrega `gameContext`
- `gameLibrary` nao participa do contrato do feed
- o endpoint `GET /posts/feed/:userId` nao aceita filtro tematico
- o payload do feed nao devolve objeto de universo

### O que claramente depende de contrato novo

- universo explicito no payload do feed
- chave estavel de universo por post
- filtro de feed por universo no backend
- qualquer suporte real a universo anime/otaku

## Contrato minimo recomendado para a proxima etapa

O menor contrato novo coerente para destravar a feature e um objeto opcional por post:

```ts
type FeedUniverse = {
  kind: 'GAME';
  key: string;
  label: string;
} | null;
```

Regras:

- so existe quando houver contexto suficiente no backend
- nao substitui `gameContext`
- `platform` continua como faceta separada

Observacao importante:

- o backend atual nao possui identificador canonico de jogo no post
- portanto, `key` precisa nascer de uma regra de normalizacao explicita ou de um identificador novo introduzido depois
- enquanto isso nao existir, qualquer universo por jogo deve ser tratado como aproximacao controlada, nao como verdade absoluta

## Vertical slice futuro recomendado

### Objetivo

Entregar o primeiro "feed por universos" sem tabs complexas, sem recomendacao e sem sistema gigante de tags.

### Recorte minimo

1. Backend
   - enriquecer o payload de `GET /posts/feed/:userId` com `universe` opcional apenas para `kind: 'GAME'`
   - derivar esse universo somente de posts que tenham `gameContext.gameName`
   - manter `gameContext` intacto

2. Frontend
   - exibir um chip de universo no card quando `post.universe` existir
   - permitir um filtro simples no feed usando somente universos presentes na resposta atual

3. Fora do slice
   - anime/otaku
   - generos
   - franquias
   - recomendacao
   - navegacao nova de multiplas abas

### Por que esse recorte

- usa o endpoint atual do feed como base
- evita endpoint novo
- restringe o problema a um unico tipo de universo com sinal real no codigo atual
- torna a proxima issue pequena o suficiente para revisao

## Gaps e riscos documentados

- sem identificador canonico, nomes de jogo podem colidir ou variar
- universo por jogo nao cobre posts `TEXT` e `IMAGE` sem `gameContext`
- tentar incluir anime/otaku agora criaria feature especulativa, porque o contrato atual nao sustenta isso
- promover plataforma a universo geraria taxonomia ruim e pouco social

## Decisoes desta issue

- "Feed por universos" no CLUTCH significa agrupamento tematico, nao modalidade de post nem plataforma
- o unico universo realmente plausivel para o primeiro slice e universo de jogo
- anime/otaku fica explicitamente fora do primeiro slice por falta de contrato
- a proxima issue deve atacar primeiro contrato minimo por post, nao UI grande
