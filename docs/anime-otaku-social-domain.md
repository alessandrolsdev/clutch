# Dominio social anime/otaku no CLUTCH

## Escopo

Este documento define o dominio social minimo de anime/otaku no CLUTCH com base no codigo real atual.

Nao implementa watchlists.
Nao cria provider novo.
Nao introduz feed, showcase ou contrato em producao.
Serve para limitar escopo e destravar as proximas issues pequenas do epic `#226`.

## Fontes de verdade usadas

- `.codex/PROJECT.md`
- `frontend/CONTEXT.md`
- `backend/prisma/schema.prisma`
- `backend/src/api/routes/profile.routes.ts`
- `backend/src/core/repositories/profile.repository.ts`
- `backend/src/api/routes/integrations.routes.ts`
- `frontend/src/schemas/profile.ts`
- `frontend/src/schemas/feed.ts`
- `frontend/src/components/profile/gamer-card.tsx`
- `frontend/src/components/profile/platform-badges.tsx`
- `frontend/src/components/profile/game-library-preview.tsx`
- `frontend/src/components/feed/post-card.tsx`
- `frontend/src/components/settings/integrations-page-content.tsx`
- `docs/feed-universes.md`

## Diagnostico do estado atual

### O que o produto ja suporta

O CLUTCH ja tem tres superficies que poderiam receber sinais anime/otaku no futuro sem quebrar o produto:

- perfil publico, que ja suporta identidade, badges, plataformas conectadas, progresso social e previews curados
- settings de integracoes, que ja trabalham com providers conectados e import/sync como boundary backend-side
- library/showcase do perfil, que ja lida com colecoes publicas resumidas e preview de itens

### O que ainda nao existe

Hoje o contrato publico de profile nao contem:

- watchlist
- status de consumo
- favoritos anime/manga
- showcase otaku
- contagens ou resumo de consumo

O feed atual tambem nao tem encaixe pronto para isso:

- os tipos de post sao `TEXT`, `IMAGE`, `ACHIEVEMENT` e `GAME_SESSION`
- o unico contexto estruturado adicional e `gameContext`
- nao existe atividade anime/manga no payload do feed

### Precedentes arquiteturais reais

Existem dois precedentes importantes:

1. `platformIntegrations` ja reconhece `ANILIST` e `MYANIMELIST` no enum `Platform`.
   Isso prova que o produto ja admite, em nivel de integracao, a existencia futura de providers anime/otaku.

2. `gameLibrary` mostra um modelo social de colecao resumida no profile.
   Isso e um bom precedente de leitura social, mas nao deve ser reutilizado como dominio de anime/manga porque:
   - o shape atual e gamer
   - a semantica e "biblioteca por plataforma"
   - anime/manga exige status de consumo, nao apenas posse/importacao

### Limite atual

O dominio anime/otaku ainda nao cabe no feed nem no profile sem contrato novo.
O codigo atual suporta apenas o precedente de integracao e a superficie de showcase futura.

## Definicao minima do dominio

### O que conta como dominio social anime/otaku

No CLUTCH, o dominio social anime/otaku e a camada que transforma consumo de anime e manga em sinal de identidade publica e afinidade entre usuarios.

Ele precisa responder a tres perguntas:

- o que a pessoa acompanha ou le
- em que estado de consumo isso esta
- o que ela escolhe mostrar publicamente como parte da propria identidade

### Diferencas essenciais

#### Catalogo ou obra

E o item canonico de referencia.
Exemplos: um anime especifico ou um manga especifico.
Sem catalogo minimo, qualquer watchlist vira texto livre sem consistencia.

#### Item em watchlist

E o vinculo entre usuario e obra.
Nao e a obra em si.
Tambem nao e automaticamente um sinal social.
Ele so prova que aquele usuario declarou interesse ou consumo daquela obra.

#### Status de consumo

E o estado atual da relacao entre usuario e obra.
Nao substitui a watchlist; e um atributo dela.

#### Favorito ou showcase

E uma selecao explicitamente publica de entradas que o usuario escolhe destacar.
Isso tem valor social alto e nao deve ser confundido com lista completa.

#### Sinal social vs dado bruto pessoal

Sinal social:

- favoritos
- destaque no perfil
- resumo publico de status
- contagens agregadas de consumo

Dado bruto pessoal:

- backlog completo
- ordem interna da lista
- notas livres
- progresso detalhado por episodio/capitulo

O CLUTCH deve nascer pelo sinal social, nao pelo rastreamento pessoal completo.

## Entidades minimas propostas

O menor conjunto plausivel e:

### 1. MediaTitle

Representa a obra canonica.

Campos minimos conceituais:

- `id`
- `kind`: `ANIME` ou `MANGA`
- `canonicalTitle`
- `coverUrl` opcional
- `metadata` opcional e provider-agnostico

Observacao:
nao precisa nascer com provider externo obrigatorio.
Pode existir manualmente ou por import futuro.

### 2. UserMediaEntry

Representa a entrada do usuario para uma obra.

Campos minimos conceituais:

- `id`
- `userId`
- `mediaTitleId`
- `status`
- `isFavorite`
- `showcaseRank` opcional
- `updatedAt`

Esta entidade concentra watchlist e sinal social minimo.
Nao e necessario separar uma tabela de favoritos no primeiro momento.

### 3. MediaConsumptionStatus

Pode ser um enum compartilhado por anime e manga.
E melhor manter um unico eixo de status do que criar taxonomias diferentes cedo demais.

## Taxonomia minima de status de consumo

Status recomendados:

- `PLANNING`
- `CONSUMING`
- `COMPLETED`
- `PAUSED`
- `DROPPED`

Justificativa:

- cobre backlog, consumo ativo, concluido, pausa e abandono
- e compreensivel para anime e manga
- evita taxonomia excessiva cedo demais

Status que ficam de fora por enquanto:

- rewatching
- rereading
- on-hold separado de paused
- skipped
- custom statuses por provider

Esses estados so devem entrar quando houver necessidade concreta de produto, nao por compatibilidade com provider.

## Relacao com identidade social

### Como isso se conecta ao perfil

O perfil atual ja tem espaco conceitual para showcase:

- identidade principal no `gamer-card`
- previews e colecoes resumidas ao redor do header
- badges e plataformas conectadas
- progresso social visivel

Anime/otaku deve entrar primeiro como showcase social paralelo ao repertorio gamer, nao como substituicao do perfil atual.

### O que faz sentido socialmente

Faz sentido mostrar:

- obras favoritas
- obras em consumo agora
- contagem publica pequena de status
- listas destacadas pelo usuario

Nao faz sentido expor cedo demais:

- backlog bruto inteiro por padrao
- notas privadas
- progresso detalhado episodio a episodio

### Privado vs publico por padrao

Para o primeiro modelo:

- `isFavorite` e `showcaseRank` implicam intencao publica
- a entrada completa de watchlist nao deve ser presumida como publica automaticamente
- a visibilidade total da lista precisa de regra propria quando a feature existir

Decisao recomendada:
o primeiro slice social deve ser opt-in via showcase, nao publicacao automatica da watchlist inteira.

## Relacao com a arquitetura atual

### O que ja cabe hoje

- reconhecer AniList e MyAnimeList como providers futuros em `platformIntegrations`
- usar o profile como principal superficie consumidora de um resumo social anime/otaku
- seguir o mesmo boundary de integracoes atual:

`provider -> backend/service -> modelo normalizado do CLUTCH -> frontend`

### O que depende de contrato novo

Depende de contrato/modelagem nova:

- catalogo minimo de obras
- entradas de watchlist do usuario
- status de consumo persistido
- resumo anime/otaku no payload de `GET /profiles/:username`
- qualquer showcase social publico especifico

### O que exigiria modelagem backend especifica

- tabela ou modelo equivalente para `MediaTitle`
- tabela ou modelo equivalente para `UserMediaEntry`
- regras de unicidade por usuario e obra
- read model pequeno para perfil

### O que ainda nao deve tocar o feed

Nao deve tocar o feed nesta fase:

- novos tipos de post anime/manga
- atividade automatica no feed a partir de watchlist
- descoberta social via consumo anime/otaku

Isso fica para `#231`, depois que o dominio estiver fechado.

## Vertical slice futuro recomendado

O menor slice implementavel depois desta issue deve ser:

### Objetivo

Mostrar no perfil um showcase anime/otaku pequeno e socialmente util, sem provider externo obrigatorio e sem feed novo.

### Recorte minimo

1. Backend
   - introduzir `MediaTitle` e `UserMediaEntry`
   - permitir criacao manual minima de entradas
   - expor no profile um resumo pequeno, por exemplo:
     - `animeShowcase.featured`
     - `animeShowcase.consumingCount`
     - `animeShowcase.completedCount`

2. Frontend
   - consumir esse resumo apenas no perfil
   - renderizar um card compacto de showcase
   - sem feed, sem tabs complexas, sem provider externo

### Por que esse recorte

- e pequeno
- e socialmente legivel
- respeita a identidade publica do CLUTCH
- prepara diretamente `#230`
- deixa `#231` livre para decidir feed depois, com base em contrato real

## Gaps e riscos documentados

- `frontend/CONTEXT.md` ainda tem drift e nao pode ser tratado como unica fonte de verdade
- o enum de plataforma sozinho nao modela dominio social
- tentar colar provider externo cedo demais empurraria taxonomia do provider para dentro do produto
- publicar watchlist inteira por padrao criaria sinal social fraco e risco de UX confusa
- misturar anime/manga com `gameLibrary` degradaria o modelo dos dois dominios

## Decisoes desta issue

- o dominio anime/otaku do CLUTCH nasce como camada social de identidade e showcase, nao como rastreador pessoal completo
- a entidade central minima e a entrada do usuario para uma obra, com status e possibilidade de destaque
- a taxonomia inicial de status deve ser pequena e provider-agnostica
- o profile e a primeira superficie correta
- o feed ainda e cedo demais para essa trilha
