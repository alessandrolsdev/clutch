# Sharing e growth loops - matriz minima

## Escopo

Este documento define a matriz minima de sharing inbound/outbound do CLUTCH com base no codigo real atual.

Nao implementa share buttons.
Nao integra provider externo novo.
Nao adiciona endpoint ou contrato em producao.
Serve para alinhar as proximas issues da trilha:

- `#235` para outbound sharing
- `#236` para inbound relevante

## Fontes de verdade usadas

- `.codex/PROJECT.md`
- `frontend/CONTEXT.md` como referencia secundaria, com prioridade do codigo real quando houver drift
- `frontend/src/app/layout.tsx`
- `frontend/src/app/(auth)/page.tsx`
- `frontend/src/app/(app)/feed/page.tsx`
- `frontend/src/app/(app)/[username]/page.tsx`
- `frontend/src/app/(app)/[username]/library/page.tsx`
- `frontend/src/components/feed/feed-page-content.tsx`
- `frontend/src/components/feed/post-card.tsx`
- `frontend/src/components/profile/profile-page-content.tsx`
- `frontend/src/components/profile/gamer-card.tsx`
- `frontend/src/components/profile/game-library-preview.tsx`
- `frontend/src/components/layout/app-shell.tsx`
- `frontend/src/components/friends/friend-button.tsx`
- `frontend/src/components/landing/landing-page-content.tsx`
- `frontend/src/schemas/feed.ts`
- `frontend/src/schemas/profile.ts`
- `frontend/src/services/feed.ts`
- `frontend/src/services/profile.ts`
- `backend/prisma/schema.prisma`
- `backend/src/app.ts`
- `backend/src/api/routes/profile.routes.ts`
- `backend/src/api/routes/posts.routes.ts`
- `backend/src/api/routes/integrations.routes.ts`
- `backend/src/api/routes/uploads.routes.ts`
- `backend/src/core/repositories/post.repository.ts`
- `backend/src/config/media-upload.ts`

## Diagnostico do estado atual

### Superficies publicas e linkaveis que ja existem

Hoje o produto ja possui URLs estaveis para:

- landing publica em `/`
- perfil publico em `/:username`
- biblioteca publica em `/:username/library`

Essas tres superficies ja podem ser abertas por link sem contrato novo.

### O que ainda nao existe como unidade compartilhavel

Hoje o produto nao possui:

- pagina publica de post individual
- rota `GET /posts/:id` para leitura publica de um post
- rota publica para sessao individual
- rota publica para conquista individual
- metadata especifica por perfil, library ou post
- OG image propria por superficie
- `metadataBase`, `openGraph`, `twitter` ou canonico por rota
- qualquer acao real de share no frontend

Conclusao:

- perfil e library ja sao unidades reais de URL
- posts ainda sao agregados do feed, nao unidades outbound de verdade

### O que ja existe em integracoes e inbound

O codigo atual ja possui boundaries para:

- Steam connect e sync de library
- Epic connect
- Discord OAuth
- ingestao interna de Discord presence
- upload de imagem com URL publica em `/api/uploads/images/:filename`

Esses fluxos sao importantes, mas nao equivalem a sharing cross-platform.
Eles sao:

- account linking
- import/sync de dados
- ingestao operacional especifica

O repositorio ainda nao possui:

- ingestao de post externo
- importacao de permalink externo para virar conteudo social do CLUTCH
- modelo de referencia externa por post
- endpoint de inbound social para links de outras redes

## Definicoes minimas

### O que e outbound sharing no CLUTCH

Outbound sharing e a saida de uma unidade do produto para fora do CLUTCH por link, preview ou CTA de distribuicao.

Para contar como outbound sharing util, a unidade precisa:

- ter URL estavel
- abrir uma superficie compreensivel para quem vem de fora
- carregar identidade, contexto ou prova social suficiente

### O que e inbound relevante no CLUTCH

Inbound relevante e a entrada de uma pessoa, contexto ou conteudo externo que retorna para uma superficie real do produto.

Exemplos validos:

- visita por deep link a um perfil publico
- retorno de OAuth para concluir vinculacao
- import/sync de biblioteca por provider suportado

Exemplos que ainda nao existem:

- criar post do CLUTCH a partir de conteudo externo
- anexar referencia externa a um post do feed

### O que e growth loop no contexto do produto

Growth loop e um ciclo repetivel em que uma unidade compartilhavel do CLUTCH gera descoberta, clique, retorno ao produto e alguma acao util posterior.

No contexto atual, isso precisa nascer de:

- perfil publico
- biblioteca/showcase
- identidade gamer visivel

### O que nao conta como growth loop util

- share button em superficie sem URL propria
- copiar URL interna sem landing compreensivel
- integracao tecnica que nao gera descoberta ou reentrada
- feed autenticado tratado como share target publico
- importacao externa sem boundary claro no backend

## Matriz de superficies compartilhaveis

| Superficie | Tipo atual | Outbound hoje | Inbound hoje | Valor de growth | Limite atual |
| --- | --- | --- | --- | --- | --- |
| `/:username` | perfil publico | sim, por link direto | sim, por deep link | alto | metadata ainda generica e sem CTA de share |
| `/:username/library` | showcase/library publica | sim, por link direto | sim, por deep link | medio-alto | metadata ainda generica e sem CTA de share |
| card de `GAME_SESSION` no feed | conteudo social forte | nao como unidade propria | nao | alto em potencial | falta URL publica individual do post |
| card de `ACHIEVEMENT` no feed | conteudo social forte | nao como unidade propria | nao | alto em potencial | falta URL publica individual do post |
| `socialContinuity` no perfil | prova social nova | sim, apenas como parte do perfil | sim, via link do perfil | medio | nao e unidade autonoma; depende do perfil |
| feed `/feed` | timeline agregada | nao faz sentido como share target publico | nao | baixo | depende de sessao e nao e unidade individual |
| landing `/` | entrada publica | sim, mas generica | sim | medio | nao carrega prova social personalizada |

## Outbound vs. inbound

### O que sai do CLUTCH para fora

#### 1. Perfil publico

Ja e o melhor candidato outbound do produto atual.

Motivos:

- URL estavel
- identidade gamer reforcada nas issues recentes
- badges, plataformas, biblioteca recente e `socialContinuity` ja aparecem no payload/na UI

Dependencias faltantes:

- metadata por rota
- canonico
- CTA real de compartilhar/copiar link

#### 2. Biblioteca publica

Ja e o segundo melhor candidato outbound.

Motivos:

- URL estavel
- showcase claro de jogos e horas
- funciona como extensao da identidade do perfil

Dependencias faltantes:

- metadata especifica da rota
- CTA real de compartilhar/copiar link

#### 3. Post, sessao e conquista

Hoje ainda nao sao superficies outbound reais.

Motivos:

- nao existe URL publica de post individual
- o feed atual e agregado e autenticado
- o card do feed nao aponta para rota propria

Conclusao:

- sessao e conquista tem alto valor de sharing
- mas ainda nao podem virar share unit honesta sem contrato e rota nova

### O que entra de fora para dentro

#### 1. Reentrada por deep link

Ja existe hoje e nao exige backend novo.

Exemplos:

- abrir `/:username`
- abrir `/:username/library`

Esse e o inbound mais realista e mais proximo de um growth loop atual.

#### 2. Vinculo/import por provider

Ja existe hoje, mas nao deve ser confundido com sharing.

Exemplos:

- Steam sync
- Epic connect
- Discord OAuth

Esses fluxos ativam o produto e enriquecem identidade/showcase, mas nao sao growth loops por si so.

#### 3. Ingestao de conteudo externo

Ainda nao existe como capacidade de produto.

Para existir de forma correta, vai exigir:

- boundary obrigatoria no backend
- modelo de referencia externa
- regra de sanitizacao e moderacao
- decisao de ownership do conteudo

Isso fica para `#236`.

## Dependencias tecnicas

### O que ja cabe na arquitetura atual

- links diretos para perfil e library
- uso de `avatarUrl`, `bannerUrl`, `badges`, `platformIntegrations`, `gameLibrary` e `socialContinuity` para montar uma landing mais compartilhavel
- uso de URLs publicas de upload em `/api/uploads/images/:filename`
- metadata por rota no App Router, se a proxima issue optar por implementa-la

### O que depende de contrato novo

- post individual compartilhavel
- leitura publica de post por id
- share unit propria para sessao ou conquista
- qualquer ingestao de conteudo externo no feed
- rastreamento de origem/attribution de share

### O que depende de metadata publica

- preview melhor em perfil e library
- titulo/descricao especificos por rota
- uso consistente de URL canonica

Hoje o projeto tem apenas metadata global generica em `frontend/src/app/layout.tsx`.

### O que depende de provider externo

- one-click share para rede especifica
- leitura de share intent/provider callback
- qualquer importacao direta de conteudo de rede social

Nada disso deve entrar antes de um slice outbound simples e independente de provider.

### Principais riscos de acoplamento

1. usar o feed autenticado como alvo de sharing
2. inventar ingestao externa no frontend sem backend
3. abrir provider especifico antes de ter unidade compartilhavel forte
4. confundir integracao de conta com growth loop

## Loops de crescimento mapeados

### Loop 1 - Perfil publico para descoberta

Fluxo:

`perfil forte -> link compartilhado -> visita externa -> leitura da identidade gamer -> cadastro ou login -> retorno ao perfil/feed`

Estado atual:

- parcialmente sustentado
- falta metadata e CTA de share

### Loop 2 - Showcase de biblioteca

Fluxo:

`biblioteca publicada -> link compartilhado -> visita externa -> leitura do repertorio gamer -> exploracao do perfil -> cadastro ou login`

Estado atual:

- parcialmente sustentado
- falta metadata e CTA de share

### Loop 3 - Sessao/conquista como prova social

Fluxo desejado:

`sessao ou conquista -> share externo -> clique -> leitura da atividade -> entrada no perfil/feed`

Estado atual:

- ainda nao sustentado
- falta unidade individual de post

### Loop 4 - Reentrada por integracao enriquecedora

Fluxo:

`vinculo Steam/Epic/Discord -> perfil mais forte -> maior vontade de compartilhar perfil/library`

Estado atual:

- sustentado como loop de ativacao
- nao e outbound sharing por si so

## Vertical slice futuro recomendado

### Slice minimo para a proxima issue

O menor recorte implementavel e:

1. outbound only
2. sem provider externo
3. focado em perfil publico

### Escopo sugerido

- adicionar metadata especifica em `/:username`
- tornar o perfil publico a primeira unidade compartilhavel oficial
- adicionar uma acao local de copiar/compartilhar link do perfil
- manter o alvo de share na URL publica ja existente

### Por que esse slice

- nao exige endpoint novo
- usa a superficie mais forte do produto atual
- reaproveita identidade gamer, badges, plataformas, biblioteca e `socialContinuity`
- prepara `#235` sem antecipar `#236`

### O que fica explicitamente para depois

- library como segunda unidade outbound
- post individual
- sessao/conquista com URL propria
- provider-specific share
- importacao de conteudo externo
- tracking de growth loop

## Relacao com #235 e #236

### `#235`

Deve atacar primeiro:

- unidade outbound prioritaria
- metadata publica
- CTA minima de share

Recomendacao:

- comecar por `/:username`

### `#236`

Deve atacar:

- cenarios inbound que realmente exigem boundary backend-side
- modelo de conteudo externo
- limites de provider, ownership e moderacao

Nao deve depender de nenhum provider especifico antes da definicao de boundary.

## Decisoes desta issue

- perfil publico e a primeira unidade outbound honesta do CLUTCH
- library publica e a segunda unidade mais forte, mas nao precisa entrar antes do perfil
- posts de sessao e conquista ainda nao sao share units reais sem rota publica individual
- inbound atual mais relevante e deep link, nao importacao de conteudo externo
- account linking e import/sync enriquecem growth, mas nao substituem sharing
