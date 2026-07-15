# Modo Arena - arquitetura, regras e limites

## Escopo

Este documento define o Modo Arena do CLUTCH em duas camadas:

1. **Arena MVP**: recorte implementavel no curto/medio prazo, assincrono, baseado em desafios semanais e provas verificaveis ou semi-verificaveis.
2. **Arena 2.0 Final**: visao completa e aspiracional para ranking, patentes, temporadas, duelos, guild wars e recompensas.

Nao implementa codigo.
Nao cria modelo Prisma, endpoint, rota frontend ou reward engine.
Serve para fechar a issue #223 e desbloquear a #237 com fronteiras claras.

## Fontes de verdade usadas

- instrucoes de produto da issue #223
- issue #213
- issue #237
- `frontend/CONTEXT.md`
- `backend/prisma/schema.prisma`
- `backend/src/api/routes/posts.routes.ts`
- `backend/src/core/repositories/post.repository.ts`
- `backend/src/api/routes/presence.routes.ts`
- `backend/src/core/repositories/presence.repository.ts`
- `backend/src/api/routes/profile.routes.ts`
- `backend/src/core/repositories/profile.repository.ts`
- `backend/src/core/services/social-continuity.service.ts`
- `backend/src/core/services/community-event.service.ts`
- `backend/src/core/repositories/community-event.repository.ts`
- `backend/src/api/routes/communities.routes.ts`
- `docs/social-continuity-model.md`
- `docs/social-friend-loops.md`
- `docs/community-membership-governance-model.md`
- `docs/community-events-rsvp-model.md`
- `docs/feed-universes.md`
- `docs/shareable-clutch-units.md`
- `docs/sharing-growth-loops-matrix.md`
- `docs/anime-otaku-social-domain.md`

Observacao: `PROJECT.md` e `AGENTS.md` locais nao foram encontrados no workspace no momento desta revisao. As instrucoes de `AGENTS.md` fornecidas no contexto da tarefa foram consideradas como acordo operacional.

## 1. Diagnostico atual

### O que ja existe

O CLUTCH ja possui bases reais para um primeiro Arena MVP:

- feed com `PostType` incluindo `TEXT`, `IMAGE`, `ACHIEVEMENT` e `GAME_SESSION`;
- posts com `gameContext` opcional capturado quando a presence do usuario esta em `IN_GAME`;
- comentarios e reactions persistidos;
- `UserStats` com `level`, `xp`, `reputation`, `friendCount` e `postCount`;
- profile publico com stats, badges, plataformas conectadas, library e social continuity;
- `socialContinuity` server-side baseado em posts e comentarios;
- friendships;
- comunidades publicas;
- eventos comunitarios com RSVP;
- notificacoes sociais;
- integrations com Steam, Discord, Google, Epic e MyAnimeList em graus diferentes de confiabilidade.

### O que nao existe

Ainda nao existe no produto:

- ranking competitivo real;
- season/temporada;
- patente competitiva;
- leaderboard global;
- score Arena;
- reward engine;
- modelo de desafio competitivo;
- modelo de submissao/prova competitiva;
- antifraude formal;
- telemetria confiavel de partida em tempo real;
- guild war;
- duelo competitivo;
- regra de reset sazonal.

### O que pode ser reaproveitado

Pode ser reaproveitado no MVP:

- `Post` como fonte de prova para `GAME_SESSION` e `ACHIEVEMENT`;
- `gameContext` como contexto semi-verificavel, com cuidado;
- `CommunityEvent` e `CommunityEventRsvp` como prova de participacao comunitaria;
- `Friendship` para limitar ranking entre amigos;
- profile publico para resumo Arena;
- sharing/growth loops para card compartilhavel;
- notifications para eventos futuros de entrada, resultado e fechamento de desafio;
- provider integrations como enriquecimento futuro, nao como requisito do primeiro slice.

### O que seria inferencia fragil

Nao deve ser tratado como prova forte no MVP:

- presence passiva;
- `IN_GAME` isolado sem post/submissao;
- `level`, `xp` ou `reputation`, porque hoje nao representam progressao competitiva confiavel;
- reactions/comments como pontuacao principal;
- sync de library sozinho;
- qualquer suposta performance dentro da partida sem telemetria externa confiavel;
- achievements nao verificados por provider oficial.

### Respostas ao diagnostico obrigatorio

1. **Quais dados atuais podem alimentar Arena com seguranca?** Posts `GAME_SESSION` e `ACHIEVEMENT` como provas semi-verificaveis, eventos comunitarios/RSVP como participacao, friendships para ranking local e profile para exibicao.
2. **GAME_SESSION existe como prova usavel?** Sim, como post intencional com `gameContext`, mas e semi-verificavel porque nasce de presence/contexto do CLUTCH, nao de telemetria oficial de partida.
3. **ACHIEVEMENT existe como prova usavel?** Sim, como tipo de post, mas inicialmente deve valer como declaracao/prova leve, salvo quando vier de provider confiavel no futuro.
4. **Eventos de comunidade podem contar como participacao competitiva?** Sim, para desafios de participacao, presenca social ou missao comunitaria, desde que o evento e RSVP existam e a comunidade nao esteja arquivada.
5. **Presence passiva deve ser excluida?** Sim. Presence e contexto efemero, nao prova.
6. **Reactions/comments devem contar ou nao?** Nao como score principal no MVP. Podem ser sinal secundario antifraude/social no futuro.
7. **Existe ranking real hoje?** Nao.
8. **Existe season/temporada real hoje?** Nao.
9. **Existe score/XP competitivo confiavel hoje?** Nao.
10. **Quais contratos novos seriam necessarios?** `ArenaChallenge`, participacao, submissao/prova, score por desafio, ranking local e leitura de resumo Arena.
11. **Quais riscos de fraude/spam existem se Arena for implementada cedo demais?** Spam de posts, sessoes falsas, conquistas declaradas sem verificacao, combinacao entre amigos, guildas farmando atividade, ranking por volume e dados inconsistentes de provider.

## 2. Definicao do Modo Arena

Modo Arena e uma competicao sazonal do CLUTCH baseada em desafios, missoes e rivalidades, onde jogadores e comunidades provam sua atividade gamer por acoes verificaveis ou semi-verificaveis, sob regras explicitas, ganhando patente, badges e reconhecimento social.

### Promessa de produto

Arena transforma atividade gamer e social do CLUTCH em disputa legivel:

- desafios claros;
- prova de participacao;
- progresso comparavel;
- reconhecimento publico;
- rivalidade entre amigos e comunidades.

### Para quem e

- jogadores que querem competir sem depender de matchmaking em tempo real;
- grupos de amigos que querem disputar metas semanais;
- comunidades que querem criar rituais competitivos leves;
- usuarios que querem mostrar reconhecimento competitivo no perfil.

### Por que existe no CLUTCH

O CLUTCH ja tem identidade gamer, feed, comunidades, eventos e social continuity. Arena e a camada competitiva que organiza esses sinais em desafios com regras, limites e resultado social.

Arena nao e:

- feed social comum;
- streak de continuidade;
- so badge de perfil;
- comunidade/guilda comum;
- ranking generico por volume;
- telemetria falsa de partida.

## 3. Fronteiras

### Arena vs Feed

Feed e publicacao social.
Arena e competicao com regra, elegibilidade, score e janela de tempo.

Um post `GAME_SESSION` ou `ACHIEVEMENT` pode servir como prova para Arena, mas o feed nao deve calcular score competitivo nem virar ranking por volume.

### Arena vs Streaks/continuidade social

Continuidade social mede consistencia e recorrencia.
Arena mede disputa em desafios definidos.

Streak pode contextualizar dedicacao, mas nao deve ser patente, MMR ou criterio de vitoria.

### Arena vs Comunidades

Comunidade e pertencimento.
Arena pode usar comunidades como participantes, times ou contexto de evento, mas nao deve transformar toda comunidade em guild war automaticamente.

### Arena vs Perfil/badges

Perfil exibe reconhecimento.
Arena gera sinais competitivos que podem aparecer no perfil.

Badges e titulos nao devem ser fonte de verdade; sao output de regras Arena.

### Arena vs Presence

Presence e estado momentaneo.
Arena precisa de prova persistida.

Presence pode enriquecer contexto de um post ou mostrar que alguem esta jogando, mas nao deve pontuar sozinha.

## 4. Arena MVP

### Definicao

Arena MVP e uma superficie assincrona de desafios semanais, com entrada voluntaria, provas por acoes existentes do CLUTCH e ranking local do desafio.

### Recorte inicial

- pagina `/arena`;
- ciclo semanal simples;
- desafios assincronos;
- missoes individuais e entre amigos;
- entrada voluntaria;
- prova por `GAME_SESSION`, `ACHIEVEMENT` ou participacao em evento comunitario;
- pontuacao simples;
- ranking local do desafio ou ranking entre amigos;
- card compartilhavel de participacao/vitoria;
- sem ranking global;
- sem temporada completa;
- sem guild wars completas;
- sem missoes em tempo real.

### Entidades necessarias no MVP

MVP essencial:

- `ArenaChallenge`;
- `ArenaChallengeRule`;
- `ArenaParticipation`;
- `ArenaSubmission`;
- `ArenaScore`.

MVP opcional, se o slice ficar pequeno:

- `ArenaShareCard` como derivacao/render, nao necessariamente tabela.

Nao necessario no MVP:

- `ArenaSeason`;
- `ArenaRankSnapshot`;
- `ArenaReward`;
- guild war roster;
- reward engine.

### Acoes elegiveis no MVP

- publicar `GAME_SESSION` valida dentro da janela do desafio;
- publicar `ACHIEVEMENT` dentro da janela do desafio;
- participar de evento comunitario elegivel;
- aceitar e completar desafio entre amigos quando houver submissao valida.

### Acoes nao elegiveis no MVP

- presence passiva;
- abrir app;
- carregar feed;
- reaction/comment como score principal;
- spam de posts;
- sync de library sem acao competitiva;
- atividade externa sem prova minima no CLUTCH.

### Score inicial

Pontuacao simples recomendada:

- `GAME_SESSION`: 10 pontos por submissao aceita;
- `ACHIEVEMENT`: 15 pontos por submissao aceita;
- participacao em evento comunitario: 10 pontos;
- bonus pequeno por variedade de tipo de prova: maximo 10 pontos por desafio;
- limite diario por tipo de prova;
- limite total por desafio.

O score deve ser por desafio, nao global.

### UX minima

- `/arena` lista desafios ativos;
- card de desafio mostra regra, periodo, progresso e CTA "Participar";
- usuario ve suas submissoes e score;
- ranking local mostra participantes do desafio, preferencialmente amigos primeiro;
- resultado gera card compartilhavel simples;
- perfil pode mostrar resumo pequeno da ultima participacao ou vitoria.

### Riscos do MVP

- usuario publicar muitas sessoes falsas;
- score virar volume de post;
- achievements serem declarativos demais;
- ranking entre amigos gerar manipulacao;
- comunidade farmar evento;
- falta de provider confiavel para validar performance.

Mitigacao: limites de score, regras explicitas, ranking local, recompensas fracas no primeiro slice e sem ranking global.

## 5. Arena 2.0 Final

Arena 2.0 e a visao completa do dominio competitivo.

### Patentes globais

Naming sugerido, sem copiar nomes proprietarios de jogos:

- Bronze
- Prata
- Ouro
- Platina
- Ascendente
- Lendario
- Imortal
- Clutch Elite

Regras futuras:

- patente atual por temporada;
- historico por ciclo;
- reset parcial;
- protecao contra queda brusca;
- criterios por performance e consistencia, nao volume bruto.

### Ranking

- ranking entre amigos;
- ranking por jogo/universo;
- ranking global;
- ranking de guilda;
- ranking por desafio;
- ranking por temporada.

### Ciclos

- temporadas tematicas;
- eventos semanais;
- cerimonia semanal;
- reset parcial;
- recompensas visuais;
- historico de temporada.

### Missoes

- diarias;
- semanais;
- relampago;
- de guilda;
- de rivalidade;
- secretas.

### Desafios

- 1v1;
- desafio espelho;
- revanche;
- desafio com regras da plataforma;
- desafio com regras dos jogadores;
- desafio valendo badge, titulo ou pontos Arena.

### Guild wars

- roster;
- inscricao;
- duracao;
- regras do lider ou da plataforma;
- pontuacao coletiva;
- recompensas de guilda;
- travas contra troca oportunista de membros.

### Futuro realtime

Pode existir apenas quando houver telemetria confiavel:

- duas ou mais pessoas jogando o mesmo jogo ou partida;
- missoes em tempo real;
- validacao por provider, overlay, ingestao confiavel ou integracao oficial.

Nao entra no MVP.

## 6. Acoes elegiveis

### Pode contar

- publicar `GAME_SESSION` valida;
- registrar `ACHIEVEMENT`;
- participar de evento comunitario;
- completar desafio aceito;
- vencer duelo;
- contribuir em missao de guilda.

### Nao conta no MVP

- presence passiva;
- so abrir app;
- spam de posts;
- reactions/comments como score principal;
- atividade sem prova minima;
- sync de biblioteca sozinho;
- atualizar perfil;
- receber notificacao;
- amizade criada sem atividade competitiva.

## 7. Antifraude e integridade

### Riscos

| Risco | Probabilidade | Impacto | Mitigacao MVP |
| --- | --- | --- | --- |
| Spam de posts | Alta | Alto | limite diario e por desafio |
| Sessao falsa | Media | Alto | exigir tipo valido, janela e contexto minimo |
| Conquista nao verificada | Alta | Medio | pontuacao limitada e classificacao como prova leve |
| Manipulacao por amigos | Media | Medio | ranking local, limites e auditoria futura |
| Ranking por volume | Alta | Alto | caps e score por regra, nao por quantidade bruta |
| Guilda farmando atividade | Media | Alto | guild wars fora do MVP |
| Provider inconsistente | Media | Medio | nao depender de provider unico no MVP |

### Mitigacoes obrigatorias do MVP

- limite de pontuacao por dia/desafio;
- acoes elegiveis explicitas;
- exigir vinculo com post/tipo valido ou evento comunitario valido;
- ranking por desafio, nao global;
- nao contar presence passiva;
- permitir revisao futura/manual;
- nao dar recompensas fortes no primeiro slice;
- registrar fonte e tipo de prova em cada submissao.

## 8. Contratos/modelos futuros

### ArenaSeason

Representa uma temporada ou ciclo maior.

Campos conceituais:

- `id`
- `slug`
- `name`
- `startsAt`
- `endsAt`
- `status`
- `theme`

Status: 2.0/#237.

### ArenaChallenge

Representa um desafio jogavel.

Campos conceituais:

- `id`
- `seasonId` opcional no MVP
- `slug`
- `title`
- `description`
- `startsAt`
- `endsAt`
- `status`
- `visibility`
- `scope`: `INDIVIDUAL`, `FRIENDS`, `COMMUNITY`

Status: necessario no MVP.

### ArenaChallengeRule

Define elegibilidade e pontuacao.

Campos conceituais:

- `id`
- `challengeId`
- `proofType`: `GAME_SESSION`, `ACHIEVEMENT`, `COMMUNITY_EVENT`
- `scoreValue`
- `dailyCap`
- `challengeCap`
- `constraints`

Status: necessario no MVP.

### ArenaParticipation

Vincula usuario ao desafio.

Campos conceituais:

- `id`
- `challengeId`
- `userId`
- `joinedAt`
- `status`

Status: necessario no MVP.

### ArenaSubmission

Representa uma prova submetida ou derivada.

Campos conceituais:

- `id`
- `challengeId`
- `participationId`
- `userId`
- `proofType`
- `postId` opcional
- `communityEventId` opcional
- `status`: `PENDING`, `ACCEPTED`, `REJECTED`
- `submittedAt`
- `reviewReason`

Status: necessario no MVP.

### ArenaScore

Projecao de pontos por desafio.

Campos conceituais:

- `challengeId`
- `userId`
- `score`
- `submissionCount`
- `updatedAt`

Status: necessario no MVP, podendo nascer calculado e depois virar read model.

### ArenaRankSnapshot

Snapshot de rank/patente por temporada.

Status: 2.0/#237.

### ArenaReward

Representa badge, titulo, card, cosmetico ou reconhecimento.

Status: 2.0/#237.

## 9. UX e superficies

### MVP

- `/arena`;
- card/resumo no perfil;
- card compartilhavel simples;
- entry point no sidebar/nav;
- possivel notificacao leve para resultado de desafio.

### Futuro

- feed cards;
- paginas de guilda;
- paginas de evento;
- notification center;
- profile badges/titles;
- public share cards;
- paginas de temporada;
- historico de patente.

## 10. Vertical slice recomendado apos #223

Titulo sugerido:

`feat(arena): implementar desafios semanais assincronos`

### Objetivo

Entregar a primeira Arena real, pequena e verificavel, sem ranking global nem reward engine.

### Escopo sugerido

- modelo `ArenaChallenge`;
- modelo `ArenaParticipation`;
- modelo `ArenaSubmission`;
- listar desafios ativos;
- usuario entra no desafio;
- usuario submete post `GAME_SESSION` ou `ACHIEVEMENT` como prova;
- pontuacao simples com caps;
- ranking local do desafio ou entre amigos;
- pagina `/arena`;
- card compartilhavel simples;
- sem patentes globais;
- sem guild wars;
- sem temporadas complexas.

### Criterios de aceite sugeridos

- usuario autenticado lista desafios ativos;
- usuario entra voluntariamente em desafio;
- submissao exige post elegivel do proprio usuario;
- submissao fora da janela falha;
- score respeita caps;
- ranking do desafio e derivado de score aceito;
- presence passiva nao pontua;
- challenge encerrado nao aceita nova submissao;
- UI explica regras e limites.

## 11. Relacao com #237

A #223 define o dominio e o primeiro slice.
A #237 deve detalhar a camada competitiva persistente:

- ranking;
- temporadas;
- recompensas;
- patentes;
- resets;
- reward boundaries;
- historico competitivo;
- criterios de promocao/rebaixamento;
- como ranking global so aparece quando antifraude e provas forem fortes o suficiente.

Portanto, #237 fica desbloqueada porque agora existe uma fronteira:

- MVP: desafios semanais assincronos com score local.
- #237/2.0: sistema competitivo de longo prazo.

## Decisoes desta issue

- Arena nasce assincrona, nao realtime.
- O primeiro slice deve usar desafios semanais e entrada voluntaria.
- `GAME_SESSION`, `ACHIEVEMENT` e evento comunitario sao fontes iniciais, com confiabilidade limitada e regras explicitas.
- Presence passiva fica excluida.
- Reactions/comments nao sao score principal.
- Ranking global, patentes e recompensas fortes ficam para #237/2.0.
- Guild wars e missoes em tempo real ficam fora ate haver contrato e telemetria confiaveis.
- Arena deve gerar reconhecimento social, mas nao pode se apoiar em telemetria falsa.
