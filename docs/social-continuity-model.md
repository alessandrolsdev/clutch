# Continuidade social com amigos - modelo minimo

## Escopo

Este documento define o modelo minimo de continuidade social do CLUTCH antes de qualquer implementacao de streaks, ofensivas, titulos, badges especiais ou progresso com amigos.

Nao implementa a feature.
Nao adiciona endpoint, score, reward engine ou ranking.
Serve para limitar escopo e destravar as proximas issues da trilha social.

## Fontes de verdade usadas

- `backend/prisma/schema.prisma`
- `backend/src/api/routes/friends.routes.ts`
- `backend/src/api/routes/notifications.routes.ts`
- `backend/src/api/routes/posts.routes.ts`
- `backend/src/api/routes/profile.routes.ts`
- `backend/src/core/repositories/friend.repository.ts`
- `backend/src/core/repositories/notification.repository.ts`
- `backend/src/core/repositories/post.repository.ts`
- `backend/src/core/repositories/presence.repository.ts`
- `backend/src/core/repositories/profile.repository.ts`
- `backend/src/core/repositories/user.repository.ts`
- `backend/src/core/services/notification.service.ts`
- `frontend/src/components/feed/create-post-form.tsx`
- `frontend/src/components/feed/post-card.tsx`
- `frontend/src/components/friends/friend-button.tsx`
- `frontend/src/components/friends/friends-list.tsx`
- `frontend/src/components/notifications/notification-item.tsx`
- `frontend/src/components/notifications/notifications-page-content.tsx`
- `frontend/src/components/profile/gamer-card.tsx`
- `frontend/src/components/profile/profile-page-content.tsx`
- `frontend/src/components/profile/profile-stats.tsx`
- `frontend/src/hooks/use-presence.ts`
- `frontend/src/lib/query/social-cache.ts`
- `frontend/src/schemas/feed.ts`
- `frontend/src/schemas/friends.ts`
- `frontend/src/schemas/notifications.ts`
- `frontend/src/schemas/profile.ts`
- `frontend/src/store/presence-store.ts`

## Diagnostico do estado atual

### Eventos sociais reais que o produto ja possui

Hoje o CLUTCH ja persiste e expoe:

- post no feed
- comentario em post
- reaction em post
- pedido de amizade
- aceite de amizade
- remocao de amizade
- notificacoes derivadas desses eventos
- presence entre amigos

### Stats e sinais ja existentes

O perfil atual expoe:

- `friendCount`
- `postCount`
- `level`
- `xp`
- `reputation`

Mas, no estado atual do backend:

- `friendCount` e atualizado quando amizade e aceita ou removida
- `postCount` e atualizado quando post e criado ou removido
- `level`, `xp` e `reputation` aparecem no contrato, mas nao possuem regra de atualizacao observavel no codigo atual alem do valor inicial

Conclusao:

- `friendCount` e `postCount` sao sinais operacionais reais
- `level`, `xp` e `reputation` ainda nao podem ser tratados como base confiavel para progresso social futuro

### O que ja e visivel no produto

- feed social com posts, sessao e conquista
- lista de amigos com presence
- inbox de notificacoes
- perfil com stats e biblioteca

### O que ainda nao existe

- streak atual
- ofensiva compartilhada
- progresso com amigos
- titulos ou badges especiais ligados a continuidade
- contrato que resuma continuidade social no perfil ou no grafo de amizade

### Capacidade latente vs. funcionalidade real

Os enums de notificacao incluem `GAME_INVITE` e `FRIEND_NOW_PLAYING`, mas esta trilha ainda nao possui produtores ativos no codigo atual equivalentes aos de `FRIEND_REQUEST`, `FRIEND_ACCEPTED`, `POST_LIKE` e `POST_COMMENT`.

Presence tambem existe, mas hoje e contexto operacional e social de momento, nao evidencia suficiente de continuidade por si so.

## Definicoes minimas

### O que e continuidade social no CLUTCH

Continuidade social e a repeticao, ao longo do tempo, de acoes publicas ou friend-linked que mantem o usuario visivel e socialmente ativo dentro do grafo de amizade.

Ela precisa ser:

- observavel no produto
- sustentada por evento persistido ou derivacao server-side confiavel
- ligada a relacao com amigos ou ao espaco social compartilhado

### O que e streak

Streak e uma sequencia de dias consecutivos em que o usuario realizou pelo menos uma acao qualificadora de continuidade social.

Para o CLUTCH, streak nao deve significar:

- abrir o app
- ler notificacoes
- aparecer online por heartbeat

### O que e ofensiva

Ofensiva e uma streak compartilhada entre amigos.

Ela exige:

- amizade ja estabelecida
- recorrencia em janelas consecutivas
- criterio de reciprocidade ou participacao social compartilhada

Ofensiva nao e ranking competitivo.
Ofensiva tambem nao e apenas dois usuarios online no mesmo dia.

### O que e progresso com amigos

Progresso com amigos e o resumo visivel de continuidade que nasce do grafo social.

Exemplos validos:

- streak individual social atual
- ofensiva ativa com um amigo
- quantidade de amizades com continuidade ativa

### O que nao conta como continuidade social

- carregar pagina ou abrir o app
- marcar notificacao como lida
- manter websocket conectado
- ficar `ONLINE` ou `IN_GAME` sem acao social qualificada
- editar perfil
- sincronizar biblioteca
- enviar pedido de amizade isoladamente
- aceitar amizade isoladamente

Esses eventos podem ser contexto ou precondicao, mas nao devem alimentar streak por si so.

## Acoes elegiveis

### Acoes elegiveis primarias

Estas acoes ja existem no produto e podem sustentar continuidade real:

1. Publicar post no feed
   - `TEXT`
   - `IMAGE`
   - `ACHIEVEMENT`
   - `GAME_SESSION`

2. Comentar em post
   - especialmente quando isso conecta o usuario a conteudo de amigos

### Acoes elegiveis secundarias

Podem participar do modelo, mas nao devem sustentar streak sozinhas no primeiro slice:

1. Reagir a post
   - existe contrato real (`LIKE`, `GG`, `F`, `CLAP`, `HYPE`)
   - e valiosa como sinal de toque social
   - mas sozinha e fraca demais para virar fonte principal de streak

2. Presence entre amigos
   - ajuda a contextualizar momentos sociais
   - nao deve contar como atividade qualificadora principal

### Acoes nao elegiveis

- pedido de amizade enviado
- amizade aceita
- amizade removida
- notificacao lida
- perfil atualizado
- upload de avatar/banner
- sincronizacao de Steam/Epic

Essas acoes sao importantes no produto, mas nao representam continuidade recorrente por si so.

## Modelo minimo com amigos

### 1. Streak individual social

Definicao:

- dias consecutivos com pelo menos uma acao elegivel primaria

Objetivo:

- medir consistencia de participacao social publica

Fonte candidata:

- posts e comentarios

### 2. Ofensiva compartilhada

Definicao:

- sequencia de dias consecutivos em que uma amizade manteve participacao social compartilhada

Regra minima recomendada:

- ambos continuam amigos
- ambos tiveram atividade elegivel dentro da mesma janela diaria
- pelo menos um toque social direto existe na relacao ao longo da janela considerada

Observacao:

- a reciprocidade deve existir na definicao, mas nao precisa virar sistema pesado no primeiro slice

### 3. Progresso com amigos

Definicao:

- resumo visivel do quanto a participacao do usuario esta virando continuidade no grafo de amizade

Exemplos de leitura futura:

- streak social atual
- ofensiva mais forte ativa
- numero de amizades com continuidade ativa

## Separacao explicita de Arena e ranking competitivo

Continuidade social:

- mede consistencia
- reforca pertencimento
- gira em torno de amigos, interacao e recorrencia

Arena ou ranking competitivo:

- mede performance, disputa, temporada, ladder ou comparacao de skill

Essas trilhas nao devem ser misturadas.
Streak e ofensiva aqui nao sao elo, MMR, temporada ou leaderboard.

## Fonte de verdade e arquitetura

### O que ja cabe na arquitetura atual

- derivar eventos-base de posts, comentarios, reactions e amizades
- usar presence e notificacoes como contexto complementar
- exibir sinais futuros em perfil, amigos e shell

### O que ainda nao cabe sem contrato novo

- streak calculada server-side
- ofensiva compartilhada pronta para consumo
- resumo de progresso com amigos no perfil
- titulos ou badges especiais ligados a continuidade

### Onde a logica deve viver

A regra de continuidade deve viver no backend.

Motivos:

- o frontend nao possui historico completo confiavel
- o feed e paginado
- a notificacao e uma projeção parcial, nao um ledger
- a mesma regra precisara alimentar perfil, amizade, notificacoes e possivelmente shell

### Riscos a evitar

- usar presence como fonte de verdade de streak
- usar reaction isolada como motor principal
- acoplar continuidade a `xp` ou `reputation` antes de haver regra real de atualizacao
- deixar cada superficie derivar sua propria conta no frontend

## Dependencias de contrato novo

O primeiro passo real de implementacao exigira ao menos um contrato novo de leitura.

Exemplo minimo razoavel:

```ts
type SocialContinuitySummary = {
  currentStreakDays: number;
  activeFriendOffensiveCount: number;
  topFriendOffensive: {
    friendId: string;
    days: number;
  } | null;
};
```

Observacoes:

- isso e proposta, nao contrato atual
- o resumo precisa nascer de regra backend-side
- `level`, `xp` e `reputation` nao devem ser usados como substituto deste resumo

## Vertical slice futuro recomendado

### Objetivo

Entregar o primeiro sinal real de continuidade social sem engine completa de recompensa.

### Slice minimo

1. Backend
   - criar um resumo minimo de continuidade social por usuario
   - calcular `currentStreakDays` a partir de acoes primarias
   - calcular `activeFriendOffensiveCount` apenas para amizades com atividade compartilhada recente

2. Frontend
   - exibir esse resumo no perfil em um card compacto
   - nao criar titulo, badge especial ou sistema de recompensa ainda

3. Fora do slice
   - reward engine
   - ranking competitivo
   - season pass social
   - titulos e badges especiais como regra completa
   - loops anime/otaku ou universos

### Por que esse slice

- usa eventos que ja existem
- mantem a regra no backend
- cria primeiro sinal social visivel sem inventar economia ou ladder
- prepara o terreno para `#232` e `#233`

## Gaps e limitacoes documentados

- `xp`, `level` e `reputation` ainda nao sustentam progressao social real
- reactions existem, mas sao fracas demais para definir streak sozinhas
- notificacoes nao sao fonte de verdade; sao projeção de eventos
- presence e contexto de momento, nao evidencia suficiente de continuidade
- ofensiva com reciprocidade exigira regra server-side nova

## Decisoes desta issue

- continuidade social no CLUTCH nasce de atividade publica e friend-linked recorrente
- streak precisa ser baseada em acao qualificadora, nao em presenca passiva
- ofensiva precisa continuar separada de Arena e ranking
- o primeiro slice deve expor resumo de continuidade, nao reward engine
- `#232` e `#233` devem depender desta semantica e nao inventar progresso por conta propria
