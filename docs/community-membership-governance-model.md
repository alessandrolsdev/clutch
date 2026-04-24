# Comunidades e guildas - membership, descoberta e governanca minima

## Escopo

Este documento define a base minima de produto e arquitetura para comunidades/guildas no CLUTCH.

Nao implementa comunidades.
Nao cria chat, eventos, moderacao avancada, ranking, cargos complexos ou contratos em runtime.
Serve para fechar a issue #224 e preparar uma implementacao futura pequena, verificavel e separada da #225.

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
- `frontend/src/schemas/friends.ts`
- `frontend/src/schemas/notifications.ts`
- `frontend/src/components/friends/friends-list.tsx`
- `frontend/src/components/notifications/notification-item.tsx`
- `frontend/src/lib/query/social-cache.ts`
- `docs/social-continuity-model.md`
- `docs/social-friend-loops.md`

## Diagnostico do estado atual

### O que ja pode servir de base

O produto atual ja possui algumas bases sociais reais:

- `FriendRequest` e `Friendship` provam um fluxo de relacao, aceite e remocao.
- `GET /friends/:userId` ja expoe uma rede social simples.
- `Post`, `Comment` e `Interaction` sustentam atividade social publica no grafo de amigos.
- `Notification` ja funciona como projecao de eventos sociais pontuais.
- `Presence` ja sabe publicar atualizacao escopada para amigos.
- `Profile` e `UserStats.friendCount` ja mostram sinais sociais no perfil.

Essas pecas sao precedentes uteis, mas nenhuma delas representa pertencimento coletivo.

### O que amizades, feed e perfil sustentam hoje

Amizades sustentam:

- relacao bilateral
- pedido pendente
- aceite
- remocao
- contagem simples no perfil

Feed sustenta:

- posts do usuario e de amigos
- comentarios e reactions
- diario gamer com `gameContext`

Perfil sustenta:

- identidade publica
- stats
- biblioteca
- social continuity
- showcase otaku
- lista de amigos

Conclusao: o produto tem relacoes e atividade social, mas ainda nao tem entidade de grupo, membership coletivo ou descoberta de comunidades.

### O que ajuda descoberta de grupos hoje

Hoje nao existe:

- rota publica de comunidades
- busca de comunidades
- slug de comunidade
- diretorio de grupos
- comunidade associada ao perfil
- comunidade associada ao feed

O que existe como base indireta:

- perfil publico linkavel
- library publica
- feed social
- platform integrations
- presence com jogo atual

Esses sinais ajudam a entender interesses do usuario, mas nao criam descoberta de grupo sem contrato novo.

### Precedentes uteis de notificacoes e presence

Notificacoes atuais mostram um padrao util:

- evento persistido
- payload pequeno
- leitura por usuario
- opcionalmente fan-out via Redis

Presence atual mostra outro padrao util:

- fan-out escopado
- recipient list controlada pelo backend
- fallback para snapshot

Para comunidades, esses precedentes podem ser reutilizados depois, mas nao devem virar chat nem realtime de comunidade no primeiro slice.

### O que claramente exige contrato novo

Comunidades/guildas exigem modelagem propria para:

- comunidade
- membership
- owner
- estado de membership
- descoberta/listagem
- governanca minima
- contadores de membros
- convite ou entrada, quando aplicavel

Nao ha como derivar isso de `Friendship` sem distorcer o dominio.

## Definicao minima do dominio

### O que conta como comunidade/guilda no CLUTCH

Comunidade/guilda e um espaco persistente de pertencimento em torno de uma afinidade social compartilhada.

Ela precisa ter:

- identidade propria
- membros
- owner responsavel
- regra simples de entrada
- superficie minima de descoberta ou acesso
- governanca basica para manter o grupo utilizavel

### Diferenca entre amizade, grupo, comunidade e guilda

Amizade:

- relacao bilateral entre dois usuarios
- nao tem identidade propria
- nao tem governanca
- ja existe no produto

Grupo:

- conjunto pequeno ou temporario de pessoas
- pode existir futuramente como contexto de conversa, party ou evento
- nao deve ser entidade principal neste primeiro dominio

Comunidade:

- espaco persistente e potencialmente descobrivel
- organizado por afinidade, jogo, plataforma, estilo de jogo ou tema social
- pode existir sem chat em escala

Guilda:

- comunidade com pertencimento mais forte e identidade mais fechada
- pode ter regras de entrada mais seletivas
- no primeiro modelo, nao precisa de um dominio separado de `Community`

Decisao: usar um unico dominio conceitual de `Community`. "Guilda" e uma leitura de produto para comunidades com membership forte, nao uma entidade separada no primeiro slice.

### O que nao entra neste primeiro recorte

Nao entra:

- chat persistente
- canais
- cargos complexos
- permissao granular
- eventos comunitarios detalhados
- calendario
- ranking competitivo
- moderacao avancada
- descoberta algoritimica
- recomendacao automatica
- feed por comunidade

Eventos comunitarios ficam para a #225.

## Membership minimo

### Roles minimas

O menor modelo plausivel tem apenas:

- `OWNER`
- `MEMBER`

`OWNER` pode:

- editar dados basicos da comunidade
- remover membros
- arquivar ou desativar a comunidade

`MEMBER` pode:

- ver a comunidade
- aparecer na lista de membros
- sair da comunidade

Moderador/admin fica fora do primeiro slice.
Se aparecer necessidade real, pode entrar depois como `MODERATOR`, mas nao deve ser pre-criado sem caso de uso.

### Estados minimos de membership

Estados recomendados:

- `ACTIVE`
- `PENDING`

`ACTIVE` representa pertencimento confirmado.
`PENDING` so e necessario quando houver pedido de entrada ou convite.

Para o primeiro slice funcional, o caminho mais seguro e evitar `PENDING` se a descoberta for publica com entrada aberta.

### Entrada

Opcoes avaliadas:

- entrada aberta em comunidade publica
- pedido de entrada
- convite direto
- invite link

Decisao para o primeiro slice: comunidade publica com entrada aberta.

Motivos:

- valida pertencimento sem criar inbox nova
- reduz moderacao inicial
- evita workflow de convite antes de haver superficie de comunidade
- entrega descoberta e membership em uma unidade pequena

Convite e pedido de entrada devem ficar para depois, quando houver evidencia de necessidade de comunidades fechadas.

### Saida

Todo membro deve poder sair.

Regras minimas:

- `MEMBER` pode sair a qualquer momento.
- `OWNER` nao pode abandonar se for o unico owner sem transferir ou arquivar a comunidade.
- Se transferencia de ownership nao existir no primeiro slice, owner so pode arquivar a comunidade.

### Limites minimos de participacao

Primeiro slice deve ter limites simples:

- usuario autenticado pode criar comunidade
- usuario autenticado pode entrar em comunidade publica
- usuario nao pode ter membership duplicado na mesma comunidade
- comunidade arquivada nao aceita novos membros
- owner sempre e membro ativo

Limites de quantidade por usuario, limite de membros e verificacao antispam devem ser definidos quando houver implementacao real.

## Descoberta inicial

### O que deve ser publico

Comunidades publicas podem expor:

- nome
- slug
- descricao curta
- avatar/banner opcional
- owner publico
- memberCount
- createdAt
- tags simples futuras, se houver contrato

### O que nao deve ser publico por padrao

Nao expor no primeiro slice:

- lista completa de membros em paginas abertas sem necessidade
- historico de remocao
- pedidos de entrada
- regras internas longas
- atividade privada

### Publica, privada ou hibrida

Para o primeiro slice, usar apenas comunidade publica descobrivel.

`INVITE_ONLY` ou `UNLISTED` ficam como evolucao posterior.

Motivo:

- discovery e pertencimento sao os objetivos centrais da primeira validacao
- comunidade privada exigiria convite, request flow, notificacao e governanca mais cedo
- o produto ainda nao tem superficie de grupo suficiente para justificar complexidade

### Descoberta recomendada

Primeira descoberta deve ser simples:

- listagem de comunidades publicas
- ordenacao por criacao recente ou memberCount
- busca textual por nome/slug, se o backend suportar sem indice complexo
- pagina publica por slug

Nao incluir recomendacao, ranking, fandom graph ou algoritmo social neste recorte.

## Governanca minima

### Acoes administrativas minimas

`OWNER` deve conseguir:

- atualizar nome, descricao e imagem basica
- arquivar comunidade
- remover membro

### Regras minimas

- Toda comunidade tem exatamente um owner inicial.
- Owner precisa ser membro ativo.
- Slug deve ser unico.
- Comunidade arquivada nao aparece em descoberta principal.
- Comunidade arquivada nao aceita join.
- Remocao de membro deve ser persistida de forma audivel no minimo por `updatedAt` ou status.

### Moderacao inicial

Moderacao inicial deve ser limitada a:

- owner remove membro
- owner arquiva comunidade
- sistema valida nome/descricao/slug

Nao entra:

- ban list completa
- report queue
- escalation workflow
- appeal
- cargos customizados
- auditoria detalhada

Essas frentes exigem modelagem propria e nao devem bloquear o primeiro teste de pertencimento.

## Relacao com a arquitetura atual

### O que ja cabe hoje

O projeto ja tem padroes suficientes para uma futura implementacao pequena:

- rotas Fastify finas
- repositories Prisma
- services para regras de negocio
- notificacoes como projecao futura
- React Query no frontend
- schemas Zod para contratos
- UI autenticada com App Router

Tambem ja ha precedentes de:

- membership simples em amizade
- contadores sociais em profile stats
- feed baseado em grafo social
- realtime escopado por relacao

### O que depende de contrato novo

Depende de contrato novo:

- `Community`
- `CommunityMember`
- `CommunityRole`
- `CommunityVisibility`
- endpoints de criacao/listagem/join/leave
- pagina de comunidade por slug
- schemas frontend de community
- cache keys e invalidacao de community

### O que nao deve ser presumido

Nao presumir:

- chat
- feed por comunidade
- eventos da #225
- moderacao avancada
- convite privado
- presence coletiva
- notificacao de toda acao comunitaria
- recomendacao automatica

Essas capacidades podem aparecer depois, mas nao pertencem ao modelo minimo.

## Contrato conceitual minimo futuro

Shape conceitual para uma futura implementacao:

```ts
type Community = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  visibility: 'PUBLIC';
  status: 'ACTIVE' | 'ARCHIVED';
  owner: {
    id: string;
    username: string;
    displayName: string | null;
  };
  memberCount: number;
  createdAt: string;
};

type CommunityMembership = {
  communityId: string;
  userId: string;
  role: 'OWNER' | 'MEMBER';
  status: 'ACTIVE';
  joinedAt: string;
};
```

Observacoes:

- `visibility` nasce como `PUBLIC` no primeiro slice.
- `PENDING`, `INVITE_ONLY` e `MODERATOR` ficam reservados, nao implementados por antecipacao.
- O shape e proposta arquitetural, nao contrato atual.

## Vertical slice futuro recomendado

### Objetivo

Validar pertencimento comunitario sem abrir chat, evento ou moderacao pesada.

### Recorte minimo

1. Backend
   - criar `Community`
   - criar `CommunityMember`
   - criar comunidade publica
   - listar comunidades publicas
   - entrar em comunidade publica
   - sair de comunidade
   - arquivar comunidade como owner

2. Frontend
   - rota autenticada de descoberta/listagem
   - pagina simples de comunidade por slug
   - CTA de entrar/sair
   - estado honesto sem comunidades

3. Fora do slice
   - chat
   - eventos/RSVP da #225
   - cargos customizados
   - convite privado
   - feed por comunidade
   - notificacoes comunitarias amplas

### Criterios de aceite do slice futuro

- usuario autenticado cria comunidade publica
- comunidade aparece na descoberta publica
- usuario entra e sai de comunidade sem duplicidade
- owner nao perde controle da comunidade
- comunidade arquivada some da descoberta e bloqueia join
- nenhuma funcionalidade promete chat, evento ou moderacao avancada

## Gaps e riscos

### Gaps

- nao ha tabela de comunidade
- nao ha tabela de membership
- nao ha rotas `/communities`
- nao ha pagina de descoberta
- nao ha pagina de comunidade
- nao ha notification type comunitario
- nao ha moderacao alem de regras gerais de produto

### Riscos

| Risco | Probabilidade | Impacto | Mitigacao |
|---|---|---|---|
| Virar "Discord dentro do CLUTCH" cedo demais | Media | Alto | bloquear chat/canais no primeiro slice |
| Overengineering de roles | Media | Medio | iniciar apenas com `OWNER` e `MEMBER` |
| Comunidades publicas virarem spam | Media | Medio | validar slug/nome e prever arquivamento pelo owner |
| Misturar eventos da #225 | Alta | Medio | manter eventos fora do contrato de community #224 |
| Feed por comunidade exigir contrato grande | Media | Alto | nao incluir feed por comunidade no primeiro slice |
| Owner abandonar comunidade sem governanca | Media | Medio | bloquear saida do unico owner sem arquivar/transferir |

## Decisoes desta issue

- Comunidade/guilda deve nascer como dominio proprio, nao derivado de amizade.
- Primeiro modelo conceitual usa `Community` e `CommunityMember`.
- Primeiro slice deve validar comunidade publica descobrivel com join/leave.
- Roles iniciais devem ser apenas `OWNER` e `MEMBER`.
- Descoberta inicial deve ser publica e simples.
- Governanca inicial deve ser owner editar, remover membro e arquivar.
- Chat, eventos, convite privado, moderacao avancada e feed por comunidade ficam fora.
- #225 deve depender deste modelo para eventos, mas nao ser implementada junto.
