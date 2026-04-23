# Unidades compartilhaveis do CLUTCH - prioridade minima

## Escopo

Este documento define quais unidades do CLUTCH devem ser compartilhaveis primeiro para redes externas e quais requisitos minimos cada uma precisa ter.

Nao implementa metadata.
Nao implementa CTA de share.
Nao integra provider externo.
Nao cobre ingestao de conteudo externo.

Serve para fechar a definicao da `#235` e preparar a proxima issue de implementacao outbound.

## Fontes de verdade usadas

- `docs/sharing-growth-loops-matrix.md`
- `.codex/PROJECT.md`
- `frontend/CONTEXT.md` como referencia secundaria
- `frontend/src/app/layout.tsx`
- `frontend/src/app/(app)/layout.tsx`
- `frontend/src/app/(app)/[username]/page.tsx`
- `frontend/src/app/(app)/[username]/library/page.tsx`
- `frontend/src/components/layout/app-shell.tsx`
- `frontend/src/components/friends/friend-button.tsx`
- `frontend/src/components/profile/profile-page-content.tsx`
- `frontend/src/components/profile/gamer-card.tsx`
- `frontend/src/components/profile/game-library-preview.tsx`
- `frontend/src/components/library/library-page-content.tsx`
- `frontend/src/components/feed/feed-page-content.tsx`
- `frontend/src/components/feed/post-card.tsx`
- `frontend/src/schemas/profile.ts`
- `frontend/src/schemas/feed.ts`
- `backend/src/api/routes/profile.routes.ts`
- `backend/src/api/routes/posts.routes.ts`
- `backend/src/config/media-upload.ts`

## Diagnostico do estado atual

### URLs publicas e estaveis que ja existem

Hoje o produto ja possui tres superfices linkaveis sem contrato novo:

- `/`
- `/:username`
- `/:username/library`

O shell atual nao bloqueia `/:username` nem `/:username/library` por autenticacao. O perfil e a library carregam por `GET /profiles/:username`, e a unica acao explicitamente dependente de sessao dentro do perfil publico e o botao de amizade.

### Superficies que ja fazem sentido fora do produto

No estado atual, apenas duas unidades ja tem contexto suficiente para fazer sentido fora do CLUTCH:

- perfil publico
- library publica

Motivos:

- ambas possuem URL estavel
- ambas carregam dados reais de identidade gamer
- ambas tem leitura util sem exigir sessao autenticada

### Superficies promissoras, mas ainda nao reais

As superficies abaixo tem potencial alto, mas ainda nao sao share units honestas:

- card de `GAME_SESSION`
- card de `ACHIEVEMENT`
- post individual

Bloqueios atuais:

- nao existe rota publica de post individual
- nao existe `GET /posts/:id` publico
- o feed atual e agregado e orientado a sessao autenticada
- nao existe metadata por rota para post, sessao ou conquista

### Metadata publica atual

Hoje o App Router so expoe metadata global generica em `frontend/src/app/layout.tsx`.

Nao existe no frontend:

- `generateMetadata`
- `metadataBase`
- `openGraph`
- `twitter`
- `alternates`
- canonico por rota
- qualquer chamada a `navigator.share`

## Definicao minima de unidade compartilhavel

No CLUTCH, uma unidade compartilhavel precisa ter:

1. URL publica estavel
2. landing compreensivel fora de uma sessao autenticada
3. identidade visual ou social suficiente para justificar o clique
4. contexto textual minimo para explicar o valor da unidade
5. CTA util de retorno ou entrada no produto
6. contrato honesto, sem depender de dados que o backend ainda nao expõe

Se qualquer um desses pontos faltar, a superficie ainda nao deve ser tratada como share unit oficial.

## Lista priorizada de unidades

| Prioridade | Unidade | Estado atual | Valor social/viral | Status para share |
| --- | --- | --- | --- | --- |
| P0 | Perfil publico `/:username` | real | alto | pronto para primeiro slice outbound |
| P1 | Library publica `/:username/library` | real | medio-alto | segunda unidade outbound |
| P1 | `socialContinuity` dentro do perfil | real, mas embutido | medio | sinal de reforco, nao unidade isolada |
| P2 | Sessao ou conquista como parte do perfil/feed | parcial | alto em potencial | nao tratar como share unit isolada agora |
| P3 | Post individual | inexistente como superficie publica | alto em potencial | bloqueado por contrato novo |
| P3 | Landing `/` | real | medio | util para descoberta, mas fraca como share unit social |

## Requisitos minimos por unidade

### 1. Perfil publico `/:username`

**Por que entra primeiro**

- ja concentra identidade gamer, badges, plataformas, biblioteca recente e `socialContinuity`
- ja funciona como landing publica sem backend novo
- ja possui valor social suficiente para compartilhamento por link

**Requisitos minimos**

- URL: `/:username`
- metadata minima:
  - titulo com `displayName` ou `username`
  - descricao curta com bio ou fallback orientado a identidade gamer
  - URL canonica
- preview desejavel:
  - `bannerUrl` quando existir
  - fallback para `avatarUrl` ou imagem padrao
- contexto textual minimo:
  - nome
  - username
  - sinal de identidade gamer real, como badges, plataformas ou biblioteca recente
- CTA desejavel:
  - entrar no CLUTCH
  - ver biblioteca
  - copiar ou compartilhar o link

**Cabe hoje na arquitetura?**

Sim. Depende principalmente de metadata por rota e de uma acao local de share, sem endpoint novo.

### 2. Library publica `/:username/library`

**Por que entra em seguida**

- ja e URL publica real
- funciona como showcase do repertorio gamer
- complementa o perfil sem exigir novo contrato

**Requisitos minimos**

- URL: `/:username/library`
- metadata minima:
  - titulo com username e contexto de biblioteca
  - descricao curta com contagem de jogos ou plataformas quando disponivel
  - URL canonica
- preview desejavel:
  - collage de capas no futuro
  - fallback inicial para banner/avatar do perfil ou imagem padrao
- contexto textual minimo:
  - nome do perfil
  - volume ou recorte da biblioteca
  - indicio de plataforma ou horas registradas
- CTA desejavel:
  - ver perfil completo
  - entrar no CLUTCH
  - copiar ou compartilhar o link

**Cabe hoje na arquitetura?**

Parcialmente. A superficie ja existe, mas depende de metadata por rota e de um tratamento de preview melhor para ser share unit forte.

### 3. `socialContinuity` como amplificador do perfil

**O que ela e**

Nao e unidade propria. E um reforco de prova social dentro do perfil publico.

**Requisitos minimos**

- nao precisa de URL propria
- pode aparecer em titulo, descricao ou preview do perfil quando isso fizer sentido
- nao deve ganhar CTA de share separado

**Cabe hoje na arquitetura?**

Sim, mas apenas como parte do perfil. Nao deve virar share unit isolada.

### 4. Sessao e conquista como share hook futuro

**O que elas sao hoje**

Sinais fortes dentro do feed, mas ainda nao superficies publicas individuais.

**Requisitos minimos para virarem unidades futuras**

- URL publica individual
- rota de leitura publica por post
- metadata propria
- contexto textual por sessao ou conquista

**Cabe hoje na arquitetura?**

Nao. Depende de contrato novo e sai do escopo desta trilha documental.

## O que ja cabe na arquitetura atual

- usar `/:username` como primeira unidade compartilhavel oficial
- usar `/:username/library` como segunda unidade compartilhavel
- reaproveitar `badge`, `platformIntegrations`, `gameLibrary` e `socialContinuity` como prova social dentro do perfil
- usar media publica de uploads em `/api/uploads/images/:filename` como ativo elegivel para previews futuros
- adicionar metadata por rota no App Router sem mexer no backend

## O que depende de contrato novo

- post individual compartilhavel
- sessao ou conquista com URL propria
- leitura publica de post por id
- qualquer share attribution ou tracking de origem
- qualquer conteudo externo entrando no feed

Esses pontos nao entram nesta issue e continuam separados da `#236`.

## Dependencias tecnicas principais

### O que depende so de frontend/App Router

- metadata por rota para `/:username`
- metadata por rota para `/:username/library`
- URL canonica
- CTA local de compartilhar ou copiar link

### O que depende de preview melhor, mas nao necessariamente de backend novo

- imagem de preview mais forte para perfil
- imagem de preview mais forte para library
- criterio de fallback entre `bannerUrl`, `avatarUrl` e imagem padrao

### Riscos de overengineering

1. tentar resolver perfil, library e post individual no mesmo slice
2. abrir provider-specific share antes de validar a unidade outbound basica
3. criar pipeline de OG image complexa antes de metadata minima por rota
4. confundir `socialContinuity` com unidade autonoma de share

## Vertical slice futuro recomendado

### Slice minimo

O menor slice implementavel depois desta issue deve ser:

- outbound only
- sem provider externo
- centrado em `/:username`

### Escopo recomendado

1. adicionar metadata por rota para o perfil publico
2. definir titulo, descricao e canonico minimos do perfil
3. adicionar CTA local de copiar ou compartilhar o link do perfil
4. manter a library como follow-up imediato, nao como parte do primeiro corte

### Por que esse corte

- usa a unidade com maior valor social atual
- nao exige endpoint novo
- reaproveita a identidade gamer ja fortalecida nas issues recentes
- respeita a fronteira estabelecida na `#234`
- nao invade a `#236`

### O que fica explicitamente para depois

- metadata e CTA da library
- post individual
- sessao/conquista com URL propria
- provider-specific share
- tracking de origem

## Fronteira com a #236

Esta issue trata apenas de unidades outbound do proprio CLUTCH.

Nao cobre:

- ingestao de conteudo externo
- permalink externo anexado a post
- provider callback para share
- ownership e moderacao de conteudo vindo de fora

Esses pontos continuam reservados para a `#236`.

## Decisoes desta issue

- `/:username` e a primeira share unit oficial que deve ser implementada
- `/:username/library` e a segunda share unit e nao precisa entrar no mesmo slice do perfil
- `socialContinuity` so deve reforcar o perfil, nunca ser tratada como unidade autonoma
- sessao, conquista e post individual continuam fora do estado atual por falta de rota publica e contrato proprio
