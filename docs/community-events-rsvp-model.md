# Eventos comunitarios - modelo minimo, RSVP e moderacao

## Escopo

Este documento define o modelo minimo de eventos comunitarios para o CLUTCH.

Nao implementa calendario.
Nao cria reminders, recorrencia avancada, notificacoes de evento, chat, live rooms ou moderacao completa.
Serve para fechar a issue #225 e preparar uma implementacao futura pequena, verificavel e dependente do modelo de comunidades definido na #224.

## Fontes de verdade usadas

- `backend/prisma/schema.prisma`
- `backend/src/api/routes/friends.routes.ts`
- `backend/src/core/repositories/friend.repository.ts`
- `backend/src/api/routes/posts.routes.ts`
- `backend/src/core/repositories/post.repository.ts`
- `backend/src/api/routes/notifications.routes.ts`
- `backend/src/core/repositories/notification.repository.ts`
- `backend/src/core/services/notification.service.ts`
- `backend/src/api/routes/presence.routes.ts`
- `backend/src/core/repositories/presence.repository.ts`
- `frontend/CONTEXT.md`
- `.codex/PROJECT.md`
- `frontend/src/schemas/notifications.ts`
- `frontend/src/schemas/presence.ts`
- `docs/community-membership-governance-model.md`
- `docs/social-continuity-model.md`
- `docs/social-friend-loops.md`

## Diagnostico do estado atual

### O que ja pode servir de base

O produto atual ja possui precedentes sociais uteis:

- amizades com pedido, aceite e remocao
- feed com posts, comentarios e reactions
- notificacoes persistidas com payload pequeno
- presence em tempo real escopada a amigos
- perfil publico com identidade social
- modelo conceitual de comunidade da #224

Esses precedentes ajudam a desenhar eventos, mas nao entregam agenda comunitaria por si so.

### O que existe sobre convites

O schema atual possui `GameInvite`, com:

- `senderId`
- `receiverId`
- `gameName`
- `gameId`
- `platform`
- `expiresAt`
- `createdAt`

No estado atual analisado, nao ha rota ativa de `game-invites` no backend nem contrato frontend listado em `frontend/CONTEXT.md`.

Conclusao: `GameInvite` e um precedente conceitual de convite individual, mas nao deve ser tratado como evento comunitario nem como fonte de RSVP.

### Precedentes de notificacoes, presence e feed

Notificacoes:

- servem para eventos sociais pontuais
- possuem `NotificationType`, `payload`, `isRead` e `createdAt`
- nao possuem tipo de evento comunitario

Presence:

- mostra fan-out escopado e fallback
- representa estado momentaneo, nao agenda

Feed:

- representa publicacao autoral
- nao possui contexto de comunidade
- nao deve virar agenda global no primeiro slice

Conclusao: eventos comunitarios precisam de dominio proprio. Feed, notificacoes e presence podem integrar depois, mas nao devem ser a fonte de verdade do evento.

### O que a #224 sustenta

A #224 definiu o modelo conceitual minimo:

- `Community`
- `CommunityMember`
- roles `OWNER` e `MEMBER`
- comunidade publica descobrivel
- join/leave
- arquivamento por owner
- sem chat, eventos, moderacao avancada ou feed por comunidade no primeiro slice

Eventos da #225 devem depender desse modelo:

- todo evento pertence a uma comunidade
- criacao e cancelamento dependem de role/governanca
- RSVP depende de membership ativo
- eventos nao devem existir soltos fora de comunidade

### O que claramente exige contrato novo

Ainda nao existe:

- tabela de evento comunitario
- tabela de RSVP
- status de evento
- rota `/communities/:slug/events`
- pagina ou bloco de eventos de comunidade
- moderacao de evento
- notificacao de evento
- criterio de autorizacao por membership

## Definicao minima do dominio

### O que conta como evento comunitario

Evento comunitario e um compromisso social futuro, ligado a uma comunidade, com horario definido e intencao explicita de reunir membros.

Ele precisa ter:

- comunidade dona
- titulo
- horario de inicio
- criador responsavel
- status claro
- RSVP opcional por membro

Exemplos validos:

- noite de ranked de uma guilda
- sessao cooperativa marcada
- watch party combinada dentro de uma comunidade
- encontro comunitario para jogar algo especifico

### Diferenca entre evento, post, atividade espontanea e convite social

Evento:

- tem horario futuro
- pertence a comunidade
- aceita RSVP
- tem ciclo de vida

Post ou aviso:

- comunica algo
- pode nao ter horario
- nao exige RSVP
- pertence ao feed atual ou a uma futura superficie de comunidade

Atividade espontanea:

- acontece agora
- pode ser capturada por presence ou feed
- nao cria agenda

Convite social:

- e direcionado a pessoa ou grupo pequeno
- pode expirar
- nao precisa ser publico para a comunidade

Decisao: evento comunitario nao deve ser modelado como post, presence nem `GameInvite`.

### O que nao entra neste primeiro recorte

Nao entra:

- calendario mensal/semanal completo
- recorrencia
- reminders
- push/email
- chat do evento
- live room
- waitlist
- limite de vagas
- ticketing
- co-hosts
- moderacao avancada
- recomendacao de eventos
- feed global de eventos
- eventos fora de comunidade

## Entidade minima de evento

### Campos minimos

Shape conceitual recomendado:

```ts
type CommunityEvent = {
  id: string;
  communityId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  status: 'PUBLISHED' | 'CANCELLED';
  visibility: 'COMMUNITY';
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};
```

### Campos intencionalmente fora

Nao incluir no primeiro modelo:

- recorrencia
- timezone customizada por evento
- capacity
- waitlist
- location fisica
- provider externo
- imagem propria do evento
- tags complexas
- chat room id
- reminder schedule

### Regra de horario

`startsAt` e `endsAt` devem ser armazenados como instantes em UTC.

O frontend pode exibir no timezone local do usuario.
Nao criar modelo de timezone customizada no primeiro slice.

`endsAt` pode ser nulo para eventos simples em que so o horario de inicio importa.

## RSVP basico

### Estados de RSVP

Modelo minimo:

- `GOING`
- `INTERESTED`
- `NOT_GOING`

`GOING` indica compromisso.
`INTERESTED` indica intencao fraca sem compromisso.
`NOT_GOING` permite retirar presenca de forma explicita sem apagar historico.

### Shape conceitual

```ts
type CommunityEventRsvp = {
  eventId: string;
  userId: string;
  status: 'GOING' | 'INTERESTED' | 'NOT_GOING';
  updatedAt: string;
};
```

### Regras de RSVP

- RSVP e opcional.
- Apenas membro ativo da comunidade pode responder.
- O usuario pode alterar RSVP ate o evento ser cancelado.
- RSVP em evento cancelado deve ser bloqueado.
- `NOT_GOING` pode ser usado no lugar de deletar a resposta.
- Contadores devem ser derivados no backend.

### O que fica fora

Nao incluir:

- convidados externos
- RSVP anonimo
- limite de vagas
- waitlist
- check-in
- presenca real no horario do evento
- comprovante de participacao

## Estados do evento

### Estado persistido minimo

Persistir apenas:

- `PUBLISHED`
- `CANCELLED`

`PUBLISHED` representa evento visivel e apto a RSVP.
`CANCELLED` representa evento encerrado administrativamente.

### Estados derivados pela UI

A UI pode derivar:

- `UPCOMING`: `startsAt` no futuro
- `LIVE`: janela atual entre `startsAt` e `endsAt`, se houver `endsAt`
- `PAST`: `startsAt` ou `endsAt` no passado
- `CANCELLED`: status persistido

### Por que nao persistir `DRAFT` ou `ENDED` agora

`DRAFT` exige fluxo privado de edicao, permissao e listagem separada.
`ENDED` pode ser derivado de tempo.

Ambos ficam fora do primeiro slice para manter a agenda pequena.

## Moderacao minima

### Quem pode criar

Primeiro slice recomendado:

- apenas `OWNER` da comunidade cria evento

Motivo:

- a #224 ainda nao introduz `MODERATOR`
- permitir qualquer membro criar evento exigiria fila de moderacao ou revisao
- owner-created event valida agenda social sem abrir spam cedo demais

### Quem pode editar ou cancelar

`OWNER` pode:

- editar titulo
- editar descricao
- editar horario
- cancelar evento

`MEMBER` pode:

- responder RSVP
- alterar RSVP

### O que deve ser moderavel

No minimo:

- titulo
- descricao
- status do evento
- RSVP do proprio usuario

### O que fica para depois

Fica fora:

- apagar RSVP de outros membros
- banir usuario de eventos
- report de evento
- fila de revisao
- logs/auditoria detalhada
- delegar criacao para `MODERATOR`
- co-hosts

## Superficies candidatas

### Onde eventos devem aparecer primeiro

Primeira superficie:

- pagina da comunidade

Motivo:

- evento e pertencimento de comunidade
- evita poluir feed global
- evita criar agenda universal antes de validar valor
- facilita autorizacao por membership

### Superficies secundarias futuras

Depois do primeiro slice:

- bloco "proximos eventos" no perfil do usuario
- notificacao simples quando owner cria ou cancela evento
- feed de comunidade, se existir no futuro
- shell com resumo pequeno

### O que nao deve acontecer agora

Nao colocar eventos em:

- feed global
- feed por universos
- perfil publico como bloco central
- notificacoes avancadas
- presence

Eventos podem se conectar a essas superficies depois que o dominio estiver validado.

## Relacao com a arquitetura atual

### O que ja cabe hoje

O projeto ja tem padroes para uma futura implementacao:

- rotas Fastify finas
- repositories Prisma
- services para regra de autorizacao
- schemas Zod no frontend
- React Query para leitura e invalidacao
- App Router para pagina autenticada
- notificacoes como possivel projecao posterior

### O que depende de contrato novo

Depende de contrato novo:

- `CommunityEvent`
- `CommunityEventRsvp`
- `CommunityEventStatus`
- `CommunityEventRsvpStatus`
- endpoints de listagem/criacao/edicao/cancelamento
- endpoint de RSVP
- contadores de RSVP
- autorizacao baseada em `CommunityMember`

### O que exige modelagem backend

Regras que devem viver no backend:

- evento pertence a comunidade ativa
- criador tem role permitida
- RSVP exige membership ativo
- evento cancelado bloqueia RSVP
- comunidade arquivada bloqueia criacao de evento
- contadores de RSVP sao calculados de forma consistente

O frontend nao deve calcular autorizacao nem membership por conta propria.

## Contrato conceitual minimo futuro

### Resposta de evento

```ts
type CommunityEventSummary = {
  id: string;
  communityId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  status: 'PUBLISHED' | 'CANCELLED';
  viewerRsvp: 'GOING' | 'INTERESTED' | 'NOT_GOING' | null;
  rsvpCounts: {
    going: number;
    interested: number;
  };
  createdBy: {
    id: string;
    username: string;
    displayName: string | null;
  };
};
```

### Endpoints conceituais

```text
GET    /communities/:slug/events
POST   /communities/:slug/events
PATCH  /communities/:slug/events/:eventId
POST   /communities/:slug/events/:eventId/rsvp
DELETE /communities/:slug/events/:eventId
```

Observacoes:

- `DELETE` pode ser cancelamento logico, nao remocao fisica.
- `POST /rsvp` deve ser idempotente por `eventId + userId`.
- Esses endpoints sao proposta futura, nao contrato atual.

## Vertical slice futuro recomendado

### Objetivo

Validar agenda social basica dentro de comunidade sem construir calendario completo.

### Recorte minimo

1. Backend
   - adicionar `CommunityEvent`
   - adicionar `CommunityEventRsvp`
   - listar eventos publicados de uma comunidade
   - owner cria evento publicado
   - owner cancela evento
   - membro ativo responde RSVP
   - retornar contadores `going` e `interested`

2. Frontend
   - adicionar bloco "Proximos eventos" na pagina da comunidade
   - adicionar formulario simples de criacao para owner
   - adicionar controles de RSVP para membro ativo
   - mostrar empty state honesto

3. Fora do slice
   - calendario
   - recorrencia
   - reminders
   - notificacoes avancadas
   - feed global
   - chat/live room
   - moderacao completa

### Criterios de aceite do slice futuro

- owner cria evento com titulo e horario futuro
- evento aparece na comunidade
- membro ativo responde `GOING`, `INTERESTED` ou `NOT_GOING`
- contadores mudam de forma consistente
- owner cancela evento
- evento cancelado bloqueia novo RSVP
- comunidade arquivada nao permite criar evento

## Gaps e riscos

### Gaps

- nao ha comunidade implementada em runtime ainda
- nao ha tabela de evento
- nao ha tabela de RSVP
- nao ha rotas de eventos
- nao ha pagina de comunidade para hospedar eventos
- nao ha notification type de evento
- nao ha regra de autorizacao por role comunitaria no codigo atual

### Riscos

| Risco | Probabilidade | Impacto | Mitigacao |
|---|---|---|---|
| Virar calendario complexo cedo demais | Media | Alto | limitar primeiro slice a lista de proximos eventos |
| Eventos virarem feed paralelo | Media | Medio | manter eventos dentro da pagina da comunidade |
| Spam de eventos por membros | Media | Medio | permitir criacao apenas por owner no primeiro slice |
| RSVP inconsistente | Media | Medio | tornar RSVP idempotente por `eventId + userId` |
| Notificacoes criarem ruido | Media | Medio | deixar notificacoes de evento fora do primeiro slice |
| Comunidade arquivada manter agenda ativa | Baixa | Medio | bloquear criacao e RSVP em comunidade arquivada |

## Decisoes desta issue

- Evento comunitario pertence a uma comunidade.
- Evento nao deve nascer como post, presence nem `GameInvite`.
- Primeiro modelo persiste `PUBLISHED` e `CANCELLED`; estados como `UPCOMING`, `LIVE` e `PAST` sao derivados.
- RSVP minimo usa `GOING`, `INTERESTED` e `NOT_GOING`.
- RSVP e opcional e restrito a membro ativo.
- Primeiro slice deve viver na pagina da comunidade, nao no feed global.
- Criacao/cancelamento devem ser do owner no primeiro slice.
- Notificacoes, recorrencia, calendario completo, chat/live room e moderacao avancada ficam fora.
