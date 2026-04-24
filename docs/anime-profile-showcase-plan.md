# Planejamento do showcase social anime, manga e listas no perfil

## Escopo

Este documento define o menor showcase social anime/otaku plausivel para o perfil do CLUTCH.

Nao implementa UI.
Nao adiciona provider externo.
Nao altera contrato em producao.
Nao abre feed novo.

Serve para fechar a `#230` e preparar uma implementacao pequena depois da modelagem consolidada na `#229`.

## Fontes de verdade usadas

- `.codex/PROJECT.md`
- `frontend/CONTEXT.md`
- `docs/anime-otaku-social-domain.md` da trilha da `#229`
- `frontend/src/components/profile/gamer-card.tsx`
- `frontend/src/components/profile/profile-page-content.tsx`
- `frontend/src/components/profile/profile-stats.tsx`
- `frontend/src/components/profile/game-library-preview.tsx`
- `frontend/src/components/ui/section-heading.tsx`
- `frontend/src/schemas/profile.ts`

## Diagnostico do perfil atual

### Onde o perfil ja suporta novos modulos

O perfil atual tem uma hierarquia bem definida:

- `gamer-card` concentra identidade primaria, badges, presenca, plataformas e progresso social
- abaixo do header existe uma faixa modular com `ProfileStats` e `GameLibraryPreview`
- `FriendsList` fica depois dessa faixa como leitura social adjacente

Esse desenho ja suporta um showcase novo sem quebrar o produto, desde que ele fique fora do `gamer-card`.

### Onde ha espaco para sinais anime/otaku

As areas que podem receber o showcase sem poluir o perfil sao:

- um bloco proprio abaixo da faixa de stats e library
- no maximo uma referencia textual curta no profile como parte da descricao do modulo

O header nao deve receber obras, favoritos ou contadores otaku.
Ali ja existe densidade alta de identidade gamer.

### O que ja e identidade social no perfil

Hoje o perfil ja comunica:

- identidade principal do jogador
- badges especiais
- presenca atual
- plataformas conectadas
- resumo social por stats
- preview da biblioteca gamer
- continuidade social com amigos

O showcase anime/otaku precisa entrar como camada complementar de repertorio, nao como novo eixo dominante.

### Riscos de poluicao visual

Os riscos mais claros sao:

- competir com a `gameLibrary` como segunda colecao publica
- sobrecarregar a primeira dobra com mais um card denso demais
- duplicar sinais de favoritos/badges no mesmo campo visual do `gamer-card`

Por isso, o showcase deve nascer pequeno, abaixo de stats/library e antes de friends.

## O que entra no showcase

O conjunto minimo socialmente legivel e:

### 1. Obras em destaque

Pequeno grupo de obras escolhidas pelo usuario para representar gosto e repertorio.

Regra:

- mix de anime e manga e permitido
- limite baixo de itens
- ordem manual ou `showcaseRank`

Esse e o sinal social principal.

### 2. Em consumo agora

Preview opcional de uma ou poucas obras marcadas como consumo atual.

Valor:

- mostra afinidade viva
- cria conversa social
- evita expor backlog inteiro

### 3. Contadores pequenos derivados de status

Somente contadores agregados que ajudam leitura rapida, por exemplo:

- `consumingCount`
- `completedCount`

Esses contadores so fazem sentido quando derivados de entradas publicas ou explicitamente destacadas.

### 4. Preview de listas curadas

Listas entram apenas como preview curto e curado pelo usuario, nao como watchlist completa.

Exemplos conceituais:

- favoritos
- lista tematica pequena
- selecao do mes

No primeiro slice implementavel, esse item pode ficar fora sem comprometer o valor do showcase.

## O que nao entra neste primeiro recorte

Nao entram:

- watchlist publica completa por padrao
- historico detalhado de consumo
- progresso por episodio ou capitulo
- notas pessoais
- backlog bruto inteiro
- sincronizacao automatica com provider
- atividade anime/manga no feed
- badges ou titulos novos derivados disso

Esses elementos ou sao pessoais demais, ou dependem de contrato novo maior, ou pertencem a `#231`.

## Convivencia com o perfil gamer atual

### Posicionamento recomendado

O showcase deve ser um bloco proprio na area de conteudo do perfil:

- depois da faixa `ProfileStats` + `GameLibraryPreview`
- antes de `FriendsList`

Isso preserva a leitura:

1. identidade principal no header
2. resumo social e repertorio gamer
3. repertorio anime/otaku
4. circulo social

### Regra de composicao

O showcase anime/otaku deve ser:

- complementar
- compacto
- opt-in
- claramente separado da biblioteca gamer

Ele nao deve:

- disputar o papel do `gamer-card`
- substituir `gameLibrary`
- parecer um segundo produto colado dentro do header

## Visibilidade e privacidade

### Publico por padrao

No primeiro slice, nada deve aparecer publicamente sem intencao explicita do usuario.

O minimo socialmente seguro e:

- obras destacadas manualmente
- preview de consumo atual marcado como publico
- contadores derivados apenas do subconjunto publico

### Opt-in necessario

Devem ser opt-in:

- destaque de obras
- preview de listas
- exposicao de consumo atual

### O que deve permanecer fora do publico inicial

- watchlist completa
- backlog
- progresso detalhado
- observacoes pessoais

Essa regra evita transformar o perfil em rastreador pessoal involuntario.

## Contrato minimo futuro sugerido

O menor shape plausivel para `GET /profiles/:username` e um bloco pequeno e dedicado.

```ts
type OtakuShowcase = {
  featured: Array<{
    id: string;
    kind: 'ANIME' | 'MANGA';
    title: string;
    coverUrl: string | null;
  }>;
  consumingNow: Array<{
    id: string;
    kind: 'ANIME' | 'MANGA';
    title: string;
    coverUrl: string | null;
  }>;
  consumingCount: number;
  completedCount: number;
  curatedListsPreview: Array<{
    id: string;
    title: string;
    itemCount: number;
  }>;
} | null;
```

### Restricoes

- `featured` e `consumingNow` devem ter limite baixo
- `curatedListsPreview` pode nascer vazio ou ficar fora do primeiro slice
- o bloco pode ser `null` quando o usuario nao configurar showcase

## Vertical slice futuro recomendado

O menor slice implementavel depois desta issue deve ser:

### Backend

- introduzir um read model pequeno de `otakuShowcase`
- consumir dados de `MediaTitle` e `UserMediaEntry`
- expor apenas:
  - `featured`
  - `consumingCount`
  - `completedCount`

### Frontend

- renderizar um card compacto no perfil
- sem tabs
- sem watchlist completa
- sem feed
- sem provider obrigatorio

### Valor do slice

Esse recorte valida:

- se existe valor social real em mostrar repertorio anime/otaku no perfil
- se a convivencia com a identidade gamer funciona
- se o usuario entende o bloco como showcase, nao como rastreador pessoal

## Gaps e dependencias

- a `#229` ainda esta em PR draft, entao esta issue depende de modelagem ainda nao mergeada
- o contrato atual de profile nao tem nenhum bloco anime/otaku
- listas curadas ainda precisam de definicao especifica se forem entrar depois
- o feed nao deve ser tocado antes da `#231`
- `frontend/CONTEXT.md` segue com drift em partes do produto e nao pode ser unica fonte de verdade

## Decisoes desta issue

- o showcase anime/otaku nasce como modulo proprio abaixo do header, nao dentro dele
- o sinal social principal e obra destacada, nao watchlist completa
- consumo atual e contadores agregados podem entrar, desde que sejam pequenos e opt-in
- listas entram apenas como preview curado, e podem ficar fora do primeiro slice implementavel
- a primeira implementacao deve ser profile-only, sem provider obrigatorio e sem feed novo
