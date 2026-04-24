# Atividades anime/otaku no feed e descoberta social

## Escopo

Este documento consolida a definicao minima para como atividades anime/otaku podem entrar no loop social do CLUTCH.

Nao implementa UI, novo tipo de post, recomendacao, provider externo ou alteracao de contrato.
Serve para fechar a fronteira da issue #231 e preparar uma issue futura pequena, revisavel e alinhada as definicoes das issues #229 e #230.

## Fontes de verdade usadas

- `backend/prisma/schema.prisma`
- `backend/src/api/routes/posts.routes.ts`
- `backend/src/core/repositories/post.repository.ts`
- `backend/src/api/routes/profile.routes.ts`
- `backend/src/core/services/otaku-showcase.service.ts`
- `backend/src/api/routes/notifications.routes.ts`
- `backend/src/core/services/notification.service.ts`
- `frontend/src/schemas/feed.ts`
- `frontend/src/schemas/profile.ts`
- `frontend/src/schemas/notifications.ts`
- `frontend/src/components/feed/create-post-form.tsx`
- `frontend/src/components/feed/feed-page-content.tsx`
- `frontend/src/components/feed/post-card.tsx`
- `frontend/src/components/profile/profile-page-content.tsx`
- `frontend/src/components/profile/otaku-showcase-card.tsx`
- `docs/anime-otaku-social-domain.md`
- `docs/anime-profile-showcase-plan.md`
- `docs/feed-universes.md`

## Diagnostico do estado atual

### Como o feed estrutura posts hoje

O feed atual e baseado em posts autorais.

O backend aceita e persiste apenas os tipos:

- `TEXT`
- `IMAGE`
- `ACHIEVEMENT`
- `GAME_SESSION`

O payload consumido pelo frontend expoe:

- autor
- `contentText`
- `mediaUrl`
- `type`
- `gameContext`
- contadores de comentarios e interacoes
- `createdAt`

`gameContext` e capturado apenas quando a presence do usuario esta em `IN_GAME` no momento da criacao do post.
Ele contem `gameName`, `platform` e `capturedAt`.

Conclusao: o feed atual representa diario gamer e interacao social sobre posts. Ele nao representa ainda uma trilha generica de atividades de consumo.

### Onde existe anime/otaku hoje

O dominio anime/otaku ja existe no backend como recorte minimo:

- `MediaTitle`
- `UserMediaEntry`
- `MediaKind`
- `MediaConsumptionStatus`

O profile publico consome `otakuShowcase` via `GET /profiles/:username`.
Esse showcase e nulo quando nao ha entrada publica configurada e usa apenas entradas com `showcaseRank` definido.

Conclusao: anime/otaku ja tem uma primeira superficie social no perfil, mas ainda nao tem modelo de atividade social nem presenca no feed.

### O que notificacoes sustentam hoje

As notificacoes atuais cobrem:

- amizade
- like em post
- comentario em post
- convite de jogo
- amigo jogando agora
- sistema

Nao ha `NotificationType` para anime/otaku e nao ha evento de atividade de midia.

Conclusao: notificacoes podem ser precedente arquitetural para eventos sociais explicitos, mas nao devem ser reutilizadas para sincronizacao passiva de watchlist.

### O que o feed claramente nao suporta ainda

O feed atual nao possui:

- `otakuContext`
- `mediaTitleId`
- activity ledger
- visibilidade por atividade anime/otaku
- origem do evento de consumo
- diferenca entre acao intencional e sync tecnico
- tipo de post anime/otaku
- contrato de descoberta por obra, fandom ou lista

Portanto, colocar anime/otaku diretamente no feed hoje exigiria contrato novo e poderia misturar dado pessoal de consumo com publicacao social.

## Atividades socialmente relevantes

Uma atividade anime/otaku so deve entrar no loop social quando for compreensivel fora da tela privada do usuario e tiver intencao publica clara.

Atividades candidatas:

- destacar uma obra no showcase publico
- iniciar consumo de uma obra quando o usuario optar por tornar esse sinal publico
- concluir uma obra quando isso for registrado como marco publico
- adicionar uma obra aos favoritos ou destaques
- publicar uma lista curada pequena e intencional
- comentar manualmente sobre uma obra usando o feed atual, como post `TEXT` ou `IMAGE`, sem contexto estruturado

Essas atividades tem valor social porque ajudam outros usuarios a entender repertorio, momento atual e afinidades do perfil.

## O que nao e atividade social relevante

Nao deve entrar no feed social neste primeiro modelo:

- incremento granular de episodio ou capitulo
- qualquer alteracao tecnica vinda de provider externo
- importacao ou sincronizacao de watchlist
- mudanca privada de backlog
- reordenacao interna da lista pessoal
- notas privadas ou historico detalhado
- atualizacao de capa, titulo canonico ou metadado de catalogo
- toda mudanca de status sem intencao publica

Regra pratica: se a mudanca parece tracking pessoal, sync tecnico ou manutencao de catalogo, nao e atividade social.

## Formas plausiveis de entrada no loop social

### 1. Perfil e showcase

Ja e a superficie correta agora.

O `otakuShowcase` comunica identidade sem transformar consumo em timeline automatica.
Ele cobre parte importante do valor social definido em #229 e #230: obras destacadas, consumo atual publico e contadores pequenos.

Decisao: manter o perfil como primeira superficie social ate existir modelo explicito de atividade.

### 2. Feed manual existente

O usuario ja pode publicar sobre anime/manga como `TEXT` ou `IMAGE`.
Isso e valido como expressao manual, mas nao cria contexto estruturado.

Decisao: nao sobrecarregar `gameContext` para representar anime/manga. Esse campo continua gamer.

### 3. Atividade derivada futura

Um futuro feed ou bloco de descoberta pode usar eventos derivados de acoes publicas, como `FEATURED`, `STARTED` e `COMPLETED`.

Para isso, o produto precisa de um contrato explicito de atividade, com visibilidade, obra, tipo do evento e horario.

Decisao: atividade derivada so entra depois de existir boundary backend-side para normalizacao e privacidade.

### 4. Novo tipo de post futuro

Um `PostType` especifico para anime/otaku pode fazer sentido no futuro, mas ainda e cedo.

Antes disso, o produto precisa provar:

- quais eventos merecem feed
- qual payload minimo representa a obra
- como evitar autopost de sync tecnico
- como o usuario controla visibilidade

Decisao: nao criar novo `PostType` agora.

### 5. Bloco paralelo de descoberta

Uma superficie paralela, como "amigos assistindo agora" ou "destaques otaku de amigos", pode ser mais segura que misturar tudo no feed principal.

Essa abordagem permite validar valor social antes de mudar o contrato de posts.

Decisao: este e o caminho mais seguro para o primeiro slice funcional depois do showcase.

## Relacao com a arquitetura atual

### O que ja cabe hoje

- Exibir identidade anime/otaku no perfil via `otakuShowcase`.
- Permitir posts manuais sobre anime/manga usando `TEXT` ou `IMAGE`.
- Usar comentarios e reacoes existentes quando a conversa acontece em um post manual.
- Tratar `ANILIST` e `MYANIMELIST` apenas como plataformas possiveis de integracao, nao como fonte de feed.

### O que depende de contrato novo

- Atividade anime/otaku estruturada.
- Contexto de obra em feed.
- Visibilidade por evento.
- Distincao entre evento manual, evento derivado e sync externo.
- Notificacao especifica de atividade otaku.
- Descoberta por obra, status ou lista curada.

### O que exige modelagem backend

Um contrato futuro deveria nascer no backend, nao no frontend.

Shape conceitual minimo:

```ts
type OtakuSocialActivity = {
  id: string;
  userId: string;
  type: 'FEATURED' | 'STARTED' | 'COMPLETED';
  mediaTitle: {
    id: string;
    kind: 'ANIME' | 'MANGA';
    title: string;
    coverUrl: string | null;
  };
  visibility: 'PUBLIC' | 'FRIENDS';
  occurredAt: string;
};
```

Esse shape nao deve ser implementado nesta issue.
Ele apenas define a menor fronteira plausivel para uma issue futura.

## Relacao com feed por universos

A #221 definiu "feed por universos" como agrupamento tematico baseado em contexto explicito.

Anime/otaku nao deve entrar agora como universo do feed porque ainda falta:

- evento social explicito
- chave publica de atividade
- contrato de contexto otaku no feed
- regra de visibilidade

`MediaKind` tambem nao deve virar universo sozinho.
Anime e manga sao tipos de obra, nao uma chave social suficiente para alimentar feed por universos.

## Relacao com notificacoes e descoberta

### Notificacoes

Notificacoes so fazem sentido quando houver acao social explicita.

Exemplos plausiveis no futuro:

- amigo destacou uma obra que voce tambem tem em showcase
- amigo concluiu uma obra marcada como publica
- alguem comentou em uma atividade publica de anime/manga

Nao devem gerar notificacao:

- sync de provider
- importacao de lista
- mudanca privada de status
- atualizacao granular de progresso

### Descoberta social

Descoberta pode comecar antes do feed principal.

Recortes seguros:

- perfil de amigo com `otakuShowcase`
- bloco compacto de obras em comum entre amigos
- destaque de obras publicas de amigos
- lista curada opt-in, quando existir contrato

O algoritmo de recomendacao fica fora deste escopo.

## Vertical slice futuro recomendado

### Objetivo

Validar atividade anime/otaku como sinal social sem transformar o feed atual em outro produto.

### Recorte minimo

1. Backend
   - criar uma fonte backend-side explicita para atividades publicas derivadas de `UserMediaEntry`
   - suportar apenas tres eventos: `FEATURED`, `STARTED`, `COMPLETED`
   - exigir visibilidade publica ou para amigos
   - ignorar sync tecnico e mudancas privadas

2. Frontend
   - exibir um bloco pequeno de "atividade otaku recente" em superficie adjacente ao perfil ou descoberta
   - nao misturar automaticamente no feed principal
   - nao criar timeline completa

3. Fora do slice
   - novo `PostType`
   - recomendacao
   - ranking
   - provider externo
   - watchlist publica completa
   - feed por universos anime

### Por que esse recorte

- preserva o feed gamer atual
- usa o dominio minimo ja existente
- respeita a decisao de showcase primeiro
- evita autopost de atividade privada
- deixa o usuario no controle de sinais publicos

## Gaps e riscos

- Hoje nao ha modelo de evento; `updatedAt` de `UserMediaEntry` nao e suficiente para explicar o que mudou.
- `showcaseRank` indica publicacao no perfil, mas nao registra historico social.
- Integracoes `ANILIST` e `MYANIMELIST` existem como enum, mas nao sustentam importacao ou feed.
- Usar o feed atual sem contrato novo confundiria post autoral com evento derivado.
- Notificar mudancas passivas poderia gerar spam e violar expectativa de privacidade.

## Decisoes desta issue

- Anime/otaku entra primeiro no loop social pelo perfil e showcase.
- O feed atual continua limitado a posts autorais e diario gamer.
- `gameContext` nao deve ser reaproveitado para anime/manga.
- Novo `PostType` anime/otaku fica bloqueado ate existir modelo de atividade e visibilidade.
- A proxima implementacao deve validar um bloco pequeno de atividade social derivada, preferencialmente fora do feed principal.
