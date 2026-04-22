# Continuidade com amigos - loops minimos

## Escopo

Este documento fecha a definicao da `#233` sem implementar streaks, ofensivas, badges, titulos ou reward engine.

Ele existe para responder quatro perguntas de forma objetiva:

1. quais loops com amigos o CLUTCH realmente sustenta hoje
2. o que conta como continuidade social compartilhada
3. o que ainda depende de contrato novo
4. qual e o menor slice futuro implementavel sem overengineering

## Relacao com a #222

A `#222` definiu o modelo base:

- o que e continuidade social
- o que conta e o que nao conta como streak
- por que presence, XP e notificacoes nao podem virar fonte de verdade sozinhos

Esta `#233` afunila esse modelo para a camada friend-linked:

- quais loops entre amigos existem de fato
- como streak e ofensiva deixam de ser contadores vazios
- em quais superficies do produto isso pode aparecer depois

## Fontes de verdade usadas

- `backend/prisma/schema.prisma`
- `backend/src/api/routes/friends.routes.ts`
- `backend/src/api/routes/posts.routes.ts`
- `backend/src/api/routes/notifications.routes.ts`
- `backend/src/api/routes/profile.routes.ts`
- `backend/src/core/repositories/friend.repository.ts`
- `backend/src/core/repositories/post.repository.ts`
- `backend/src/core/repositories/notification.repository.ts`
- `backend/src/core/repositories/profile.repository.ts`
- `frontend/src/components/feed/feed-page-content.tsx`
- `frontend/src/components/feed/post-card.tsx`
- `frontend/src/components/friends/friends-list.tsx`
- `frontend/src/components/notifications/notifications-page-content.tsx`
- `frontend/src/components/profile/profile-page-content.tsx`
- `frontend/src/components/profile/profile-stats.tsx`
- `frontend/src/schemas/friends.ts`
- `frontend/src/schemas/notifications.ts`
- `frontend/src/schemas/profile.ts`

## Diagnostico do estado atual

### O que o produto ja possui

Hoje o CLUTCH ja tem:

- grafo explicito de amizade
- feed formado pelo usuario e pelos amigos
- posts com `TEXT`, `IMAGE`, `ACHIEVEMENT` e `GAME_SESSION`
- comentarios e reactions em posts
- notificacoes para `FRIEND_REQUEST`, `FRIEND_ACCEPTED`, `POST_LIKE` e `POST_COMMENT`
- presence entre amigos
- perfil com `friendCount` e `postCount`

### O que o produto ainda nao possui

Hoje o CLUTCH ainda nao tem:

- streak calculada no backend
- ofensiva compartilhada entre amigos
- resumo de progresso com amigos no perfil
- contrato de continuidade em `GET /profiles/:username`
- contrato de ofensiva em `GET /friends/:userId`

### Limite central do estado atual

O produto ja tem eventos suficientes para derivar continuidade social com amigos, mas ainda nao tem um read model proprio para isso.

Na pratica:

- feed, amizade, comentario e reaction existem
- a UI ja teria onde mostrar um resumo futuro
- a fonte de verdade ainda precisara nascer no backend

## Definicoes operacionais minimas

### O que e continuidade com amigos

Continuidade com amigos e a repeticao, ao longo do tempo, de atividade social publica que continua visivel e relevante dentro do grafo de amizade.

Ela nao depende apenas do individuo ter feito algo.
Ela precisa continuar fazendo sentido no espaco compartilhado entre amigos.

### O que e streak social

Streak social e a sequencia de dias consecutivos em que o usuario realizou pelo menos uma acao qualificadora primaria.

Para o CLUTCH atual, isso deve continuar restrito a:

- publicar post
- comentar

Reaction nao deve sustentar streak sozinha no primeiro slice.

### O que e ofensiva com amigo

Ofensiva com amigo e uma streak compartilhada entre dois usuarios que:

- continuam amigos no grafo atual
- possuem atividade qualificadora nas mesmas janelas diarias consecutivas

No contexto atual, ofensiva nao significa:

- jogar juntos
- estar online ao mesmo tempo
- competir em ranking

Ela significa apenas continuidade social compartilhada entre amigos.

### O que e progresso com amigos

Progresso com amigos e um resumo visivel da continuidade que deixa de ser puramente individual.

Exemplos validos:

- streak social atual do usuario
- quantidade de ofensivas ativas
- ofensiva mais longa com um amigo

## O que nao conta como continuidade social

Nao devem contar como streak ou ofensiva:

- abrir o app
- carregar o feed
- ler notificacoes
- manter websocket conectado
- ficar `ONLINE` ou `IN_GAME` sem acao social qualificadora
- editar perfil
- sincronizar biblioteca
- enviar pedido de amizade
- aceitar amizade
- remover amizade

Esses eventos podem ser contexto, precondicao ou projecao, mas nao fonte de verdade.

## Loops sociais minimos que o produto ja sustenta

### 1. Loop de registro publico recorrente

Fluxo:

`usuario -> publica no feed -> amigos recebem no feed -> atividade fica visivel`

Esse loop ja existe hoje e sustenta:

- streak individual social
- continuidade publica do jogador

Ele ainda nao sustenta ofensiva por si so.

### 2. Loop de toque social direto

Fluxo:

`usuario A publica -> usuario B comenta ou reage -> notificacao e gerada -> relacao social fica observavel`

Esse loop ja existe hoje e e o melhor sinal friend-linked real do produto atual.

Ele sustenta:

- continuidade social entre amigos
- evidencia de reciprocidade

### 3. Loop de atividade compartilhada entre amigos

Fluxo:

`usuario A e usuario B, ja amigos, realizam atividade qualificadora no mesmo dia`

Esse loop ainda nao tem contrato pronto, mas ja pode ser derivado a partir de:

- tabela `friendships`
- tabela `posts`
- tabela `comments`

Esse e o candidato mais honesto para virar ofensiva no primeiro slice.

### 4. Loop de continuidade exibida no perfil

Fluxo futuro:

`backend deriva resumo -> perfil exibe streak e ofensiva principal -> amigos entendem quem esta em ritmo social`

Esse loop ainda nao existe, mas o perfil ja tem superficie suficiente para receber esse resumo sem redesign grande.

## Acoes elegiveis e nao elegiveis

### Elegiveis primarias

- publicar post
- comentar em post

### Elegiveis secundarias

- reagir a post de amigo

Reacao deve entrar como reforco de relacao, nao como motor principal de streak.

### Nao elegiveis

- pedido de amizade
- aceite de amizade
- remocao de amizade
- leitura de notificacao
- presence passiva
- sincronizacao de integracoes

## Automatico vs. intencional

### Automatico

- presence
- notificacoes geradas pelo backend
- grafo de amizade
- ordenacao do feed

Esses sinais ajudam a contextualizar a continuidade, mas nao devem gerar score sozinhos.

### Intencional

- publicar
- comentar
- reagir

Somente acoes intencionais devem entrar no nucleo do modelo.

## O que ja cabe na arquitetura atual

Hoje ja e possivel, sem infraestrutura nova:

- derivar dias ativos do usuario por `posts` e `comments`
- derivar grafo de amizade atual por `friendships`
- identificar toques sociais diretos por `comments` e `interactions` sobre posts de amigos
- projetar um resumo pequeno em perfil e amizades

Tambem e possivel manter a logica no backend sem empurrar regra para o frontend.

## O que depende de contrato novo

Ainda depende de contrato novo:

- resumo de continuidade social em `GET /profiles/:username`
- resumo de ofensiva em `GET /friends/:userId` ou contrato equivalente
- read model explicito com streak atual e ofensiva principal
- qualquer progressao visivel no perfil baseada nessa trilha
- titulos, badges especiais e recompensas

## Onde essa logica deve viver

Essa logica deve nascer no backend.

Motivos:

- a fonte de verdade esta em `posts`, `comments`, `interactions` e `friendships`
- o frontend nao tem contexto suficiente para calcular continuidade com consistencia
- a mesma regra precisara alimentar perfil, lista de amigos e possiveis notificacoes futuras

O frontend deve apenas renderizar o resumo retornado pelo backend.

## Riscos tecnicos para evitar gamificacao vazia

### 1. Usar XP, level ou reputation como base

Risco:

- esses campos existem no contrato, mas nao possuem hoje uma regra operacional observavel para continuidade social

Decisao:

- nao usar esses campos como fonte de verdade

### 2. Tratar presence como atividade qualificadora

Risco:

- presence e efemera e pode inflar score sem acao social real

Decisao:

- presence so pode contextualizar, nunca pontuar sozinho

### 3. Criar ofensiva sem relacao com o grafo social

Risco:

- a feature vira contador paralelo e perde sentido de amizade

Decisao:

- ofensiva so existe entre usuarios que sao amigos no grafo atual

### 4. Chamar de ofensiva algo que na pratica e apenas coincidencia de atividade

Risco:

- a feature parece artificial se dois amigos nunca interagem de verdade

Decisao:

- no primeiro slice, a regra deve ser simples e factual
- se a leitura ficar artificial, o proximo endurecimento deve usar comentario ou reaction como reforco de reciprocidade

## Slice futuro minimo recomendado

### Objetivo

Entregar o menor resumo de continuidade com amigos sem abrir reward engine, Arena ou titulos.

### Fonte de verdade do primeiro slice

- `posts`
- `comments`
- `friendships`

### Regra recomendada para o primeiro slice

- `currentStreakDays`: dias consecutivos com ao menos um post ou comentario
- `activeFriendOffensiveCount`: quantidade de amizades em que ambos tiveram atividade qualificadora no mesmo dia consecutivo
- `strongestFriendOffensive`: maior ofensiva ativa entre amizades atuais

### Contrato minimo sugerido

```ts
socialContinuity: {
  currentStreakDays: number;
  activeFriendOffensiveCount: number;
  strongestFriendOffensive: {
    friendId: string;
    friendUsername: string;
    days: number;
    lastQualifiedAt: string;
  } | null;
}
```

### Onde expor primeiro

Recomendacao inicial:

- acrescentar `socialContinuity` em `GET /profiles/:username`

Justificativa:

- o perfil ja e a superficie mais natural para ler continuidade e progresso
- evita espalhar contrato novo em feed e amizades ao mesmo tempo
- deixa a primeira implementacao pequena e revisavel

### O que fica explicitamente para depois

- usar reactions como regra principal
- exibir ofensiva em cada card de amigo
- gerar notificacao de continuidade
- dar nome, titulo ou badge especial
- conectar a trilha com Arena ou ranking competitivo

## Backlog proposto

1. `feat(profile): expor resumo minimo de continuidade social em GET /profiles/:username`
   - backend
   - fonte de verdade em `posts`, `comments` e `friendships`

2. `feat(profile): exibir streak atual e ofensiva principal no perfil`
   - frontend
   - leitura factual, sem reward engine

3. `feat(friends): mostrar ofensiva ativa em amizades prioritarias`
   - frontend e backend
   - apenas depois que o contrato do perfil estiver validado

4. `feat(social): endurecer ofensiva com sinal de reciprocidade`
   - usa `reactions` ou `comments` como reforco de relacao
   - somente se o primeiro slice mostrar falsos positivos
