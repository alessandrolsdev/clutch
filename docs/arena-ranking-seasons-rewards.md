# Modo Arena - ranking, temporadas e recompensas

## Escopo

Este documento define a camada competitiva persistente do Modo Arena:

- ranking;
- temporadas;
- resets;
- recompensas;
- patentes, titulos e badges competitivos;
- limites entre Arena MVP e Arena 2.0.

Nao implementa codigo.
Nao cria migrations.
Nao cria ranking real.
Nao cria reward engine.
Nao cria frontend de Arena.

Este documento fecha a issue #237 e complementa `docs/arena-mode-architecture.md`, criada na #223.

## Fontes de verdade usadas

- issue #213;
- issue #223;
- issue #237;
- PR #296;
- `docs/arena-mode-architecture.md`;
- `.codex/AGENTS.md`;
- `.codex/PROJECT.md`;
- `frontend/CONTEXT.md`;
- `backend/prisma/schema.prisma`;
- `backend/src/api/routes/posts.routes.ts`;
- `backend/src/core/repositories/post.repository.ts`;
- `backend/src/core/services/community-event.service.ts`;
- `backend/src/core/repositories/community-event.repository.ts`;
- `backend/src/core/services/social-continuity.service.ts`;
- `backend/src/core/repositories/profile.repository.ts`;
- `backend/src/core/services/notification.service.ts`;
- documentos de feed, continuidade social, comunidades, sharing e otaku existentes em `docs/`.

## 1. Diagnostico atual

### Dados que podem sustentar ranking competitivo

O estado atual do codigo permite sustentar apenas ranking local e de baixo risco, baseado em provas persistidas:

- posts `GAME_SESSION`;
- posts `ACHIEVEMENT`;
- eventos comunitarios e RSVP;
- amizades para filtrar comparacao entre amigos;
- profile para exibicao de resumo competitivo;
- notificacoes para avisos futuros de resultado ou encerramento.

Esses dados sao suficientes para um ranking por desafio, desde que o score seja limitado por regras explicitas e nao por volume bruto.

### O que e confiavel o suficiente para score

Confiavel o suficiente para o MVP:

- submissao de post do proprio usuario;
- tipo de post permitido pela regra do desafio;
- janela do desafio;
- participacao voluntaria no desafio;
- RSVP em evento comunitario ativo, quando o desafio aceitar esse tipo de prova.

Essa confiabilidade e suficiente para reconhecimento leve, nao para recompensas fortes.

### O que e semi-verificavel

Semi-verificavel:

- `GAME_SESSION`, porque o `gameContext` vem da presence do CLUTCH e nao de telemetria oficial da partida;
- `ACHIEVEMENT`, porque hoje e tipo de post, nao necessariamente conquista validada por provider;
- participacao em evento comunitario, porque prova engajamento no produto, mas nao performance de jogo;
- dados de biblioteca/importacao, porque indicam posse ou atividade historica, mas nao acao competitiva na janela.

### O que e fragil demais para ranking

Fragil demais para score principal:

- presence passiva;
- abrir app;
- reactions;
- comments;
- quantidade bruta de posts;
- numero de amigos;
- `UserStats.level`;
- `UserStats.xp`;
- `UserStats.reputation`;
- badges atuais do profile;
- sync de library sozinho;
- qualquer suposta performance em partida sem integracao confiavel.

### O que nao existe hoje

Ainda nao existe:

- modelo de season;
- modelo de rank/patente;
- modelo de score Arena;
- leaderboard persistido;
- reward engine;
- titulo competitivo;
- badge competitivo com regra de emissao;
- snapshot de fim de ciclo;
- revisao manual de submissao;
- antifraude formal.

### Respostas ao diagnostico obrigatorio

1. **Quais dados atuais podem sustentar ranking competitivo?** Posts `GAME_SESSION` e `ACHIEVEMENT`, eventos comunitarios/RSVP, amizade para ranking entre amigos e profile/notificacoes para exibicao futura.
2. **O que e confiavel o suficiente para score?** Provas persistidas, do proprio usuario, dentro da janela do desafio e aceitas por regra explicita.
3. **O que e semi-verificavel?** `GAME_SESSION`, `ACHIEVEMENT` e RSVP, porque provam atividade no CLUTCH, mas nao necessariamente performance externa verificada.
4. **O que e fragil demais para ranking?** Presence passiva, reactions, comments, volume bruto, stats atuais, badges atuais e sync de library.
5. **Existe algum modelo atual de season?** Nao.
6. **Existe algum modelo atual de rank/patente?** Nao.
7. **Existe reward/badge/title engine hoje?** Nao. O profile tem `badges: String[]`, mas isso nao e uma engine de recompensas competitivas.
8. **O que pode ser so documento agora?** Ranking, temporadas, resets, patentes, recompensas, tie-breakers, integridade, modelos futuros e limites MVP/2.0.
9. **O que precisa ficar para implementacao futura?** Modelos Arena, endpoints, scoring, leaderboard, UI `/arena`, rewards, snapshots e notificacoes especificas.
10. **O que o MVP nao deve tentar resolver?** Ranking global, temporada formal, guild wars, economia, moeda, loja, reward engine, realtime, MMR e telemetria de partida.

## 2. Relacao com #223 e #213

A #223 definiu o que e Arena e qual e o primeiro recorte implementavel:

- desafios semanais assincronos;
- entrada voluntaria;
- provas por `GAME_SESSION`, `ACHIEVEMENT` ou evento comunitario;
- score simples;
- ranking local do desafio ou entre amigos;
- sem ranking global;
- sem guild wars;
- sem reward engine;
- sem missoes em tempo real.

A #237 nao reabre essa decisao. Ela detalha a camada competitiva persistente que deve nascer pequena no MVP e evoluir para Arena 2.0.

A #213 pode ser revisada apos o merge desta issue porque suas duas filhas arquiteturais ficam cobertas:

- #223: definicao macro de Arena;
- #237: ranking, temporadas e recompensas competitivas.

Se o objetivo da #213 for arquitetura/backlog, ela pode ser fechada apos #237. Se o objetivo passar a ser implementacao de Arena, o correto e abrir uma issue funcional nova em vez de manter o epic aberto com escopo ambiguo.

## 3. Ranking

### Decisao central

O MVP deve ter ranking por desafio.

Ranking global, ranking por comunidade/guilda e ranking sazonal ficam para Arena 2.0.

### Ranking por desafio

Entra no MVP.

Caracteristicas:

- escopo limitado a um `ArenaChallenge`;
- mostra apenas participantes daquele desafio;
- score acumulado por submissao aceita;
- janela de inicio/fim clara;
- visibilidade limitada ao desafio;
- pode ter filtro "amigos" como modo de visualizacao, sem criar uma liga permanente.

Esse ranking e o suficiente para validar competicao sem transformar o produto em ladder global.

### Ranking entre amigos

Pode entrar no MVP como filtro do ranking por desafio.

Nao deve nascer como ranking permanente separado.

Regras:

- usa amizade existente;
- considera somente participantes do desafio;
- nao altera score;
- nao gera patente;
- nao cria recompensa forte.

### Ranking por comunidade/guilda

Fica fora do MVP.

Motivos:

- exige regras de roster;
- exige entrada/saida de membros com janela de lock;
- exige evitar troca oportunista de comunidade;
- exige score coletivo;
- exige moderacao e possivel revisao.

Pode entrar na Arena 2.0 como parte de guild wars ou temporadas comunitarias.

### Ranking global

Fica fora do MVP.

Motivos:

- aumenta incentivo a spam;
- exige antifraude mais forte;
- exige normalizacao por jogo, desafio e janela;
- exige snapshots;
- exige regras de desclassificacao;
- gera expectativa de recompensa forte.

Ranking global so deve existir quando houver:

- provas mais fortes;
- caps robustos;
- historico competitivo;
- sistema de revisao;
- regras de season;
- reward boundaries.

### Score por submissao

Cada submissao deve gerar score a partir de regra explicita do desafio.

Exemplo conceitual:

- `GAME_SESSION`: 10 pontos;
- `ACHIEVEMENT`: 15 pontos;
- `COMMUNITY_EVENT_RSVP`: 10 pontos;
- bonus de variedade: ate 10 pontos;
- caps diarios e caps por desafio.

O score nao deve ser calculado por:

- numero bruto de posts;
- reactions;
- comments;
- tempo de presence;
- reputation atual;
- numero de amigos.

### Score por desafio

O score e sempre contextual:

- pertence a um desafio;
- respeita janela do desafio;
- respeita caps do desafio;
- pode ser recalculado a partir das submissoes aceitas;
- nao vira XP global automaticamente.

### Caps recomendados

MVP:

- limite diario por tipo de prova;
- limite total por tipo de prova no desafio;
- limite total de score do desafio;
- uma submissao nao pode pontuar em multiplos desafios sem regra explicita.

Objetivo: impedir que Arena seja vencida por volume bruto.

### Empate

Tie-breaker recomendado para MVP:

1. maior score aceito;
2. maior diversidade de tipos de prova aceitos;
3. menor numero de submissoes rejeitadas;
4. primeira submissao aceita mais antiga dentro da janela;
5. empate declarado.

Nao usar reactions/comments como desempate no MVP.

### Desclassificacao e revisao

MVP nao precisa de fluxo completo de revisao manual, mas os contratos devem reservar estado para:

- submissao pendente;
- submissao aceita;
- submissao rejeitada;
- participante desclassificado;
- motivo interno de revisao.

Desclassificacao manual completa fica para 2.0 ou para uma issue de moderacao competitiva.

### Visibilidade do ranking

MVP:

- ranking visivel na pagina do desafio;
- ranking entre amigos como filtro opcional;
- resultado final pode gerar card compartilhavel;
- perfil pode exibir resumo leve, nao patente global.

Futuro:

- ranking global;
- ranking por jogo;
- ranking por comunidade;
- ranking sazonal;
- historico de temporadas.

## 4. Temporadas

### Decisao central

O MVP nao precisa de temporada formal.

O MVP deve usar desafios semanais com janela propria.

### Desafio semanal vs temporada

Desafio semanal:

- unidade pequena;
- regra simples;
- inicio e fim curtos;
- ranking local;
- recompensa fraca;
- sem reset global.

Temporada:

- ciclo maior;
- agrega varios desafios;
- gera snapshot;
- pode ter patente;
- pode ter recompensas;
- precisa de reset e historico.

### MVP

No MVP, a janela semanal do desafio substitui a temporada.

Regras recomendadas:

- desafio tem `startsAt` e `endsAt`;
- submissao fora da janela falha;
- score fecha quando o desafio termina;
- resultado fica consultavel;
- nao ha reset global de patente.

### Arena 2.0

Temporada recomendada:

- duracao inicial: 8 a 12 semanas;
- desafios semanais dentro da temporada;
- eventos tematicos;
- snapshot final;
- recap semanal;
- reset parcial;
- historico de temporada no perfil;
- recompensas por participacao e performance.

### Reset

MVP:

- nao tem reset global;
- cada desafio encerra seu proprio ranking;
- o usuario pode manter historico de participacao.

Arena 2.0:

- reset parcial de rank;
- patente atual reinicia com soft reset;
- historico preserva melhor patente e resultados;
- recompensas permanentes ficam separadas de recompensas temporarias.

### Snapshot final

MVP:

- snapshot pode ser derivado do ranking final do desafio;
- nao precisa de tabela dedicada no primeiro slice se o score for recalculavel.

Arena 2.0:

- `ArenaRankSnapshot` passa a ser necessario para preservar historico e evitar recalculo caro/instavel.

### Cerimonia e recap

MVP:

- recap simples ao fim do desafio;
- card compartilhavel;
- possivel notificacao de encerramento.

Arena 2.0:

- cerimonia semanal;
- recap de temporada;
- destaque de guilda;
- recompensas visuais;
- historico publico.

## 5. Recompensas

### Decisao central

O MVP deve usar recompensas fracas.

Recompensas fortes e reward engine ficam fora.

### Recompensas fracas para MVP

Permitidas:

- card compartilhavel de participacao;
- card compartilhavel de vitoria;
- destaque leve no perfil;
- resumo "top N do desafio";
- notificacao de resultado;
- historico simples de participacao;
- badge visual derivado e reversivel, se nao exigir engine.

Essas recompensas reconhecem participacao sem criar economia ou pressao competitiva desproporcional.

### Recompensas fortes para depois

Ficam para Arena 2.0:

- badges competitivos permanentes;
- titulos equipaveis;
- cosmeticos;
- cards raros;
- recompensas de guilda;
- patentes persistentes;
- rewards por temporada;
- rewards por ranking global;
- qualquer item com escassez ou valor social alto.

### O que nao deve existir no MVP

- moeda;
- loja;
- economia;
- marketplace;
- reward engine generica;
- loot box;
- recompensa monetaria;
- inventario competitivo;
- conversao automatica de score em XP global;
- badge permanente por score semi-verificavel.

### Badges

O profile ja possui `badges: String[]`, mas isso nao deve ser tratado como reward engine.

MVP:

- evitar emitir badge permanente automatico;
- se houver badge visual, tratar como exibicao derivada do desafio, nao como inventario.

Arena 2.0:

- `ArenaBadge` pode formalizar badges competitivos com origem, regra, temporada e revogabilidade.

### Titulos

Nao entram no MVP.

Arena 2.0 pode ter `ArenaTitle` para:

- titulo temporario da temporada;
- titulo permanente por conquista rara;
- titulo de guilda;
- titulo de rivalidade.

Titulos precisam de regra de emissao e revogacao antes de aparecerem no perfil.

### Cards compartilhaveis

Entram no MVP.

Regras:

- derivados de resultado ou participacao;
- sem expor dados sensiveis;
- sem depender de reward engine;
- nao devem prometer patente global;
- podem ser regenerados a partir do desafio e do ranking.

## 6. Patentes e tiers

### Decisao central

Patente nao entra no MVP.

Patente pertence a Arena 2.0, depois que ranking, temporada e integridade competitiva estiverem maduros.

### Naming possivel

Opcoes em linguagem propria do CLUTCH:

- Rookie;
- Contender;
- Pro;
- Elite;
- Legend;
- Clutch Elite.

Opcao mais classica:

- Bronze;
- Prata;
- Ouro;
- Platina;
- Ascendente;
- Lendario;
- Imortal;
- Clutch Elite.

A decisao final de naming deve ser tratada como produto/brand antes de implementacao.

### Como evitar frustracao cedo demais

Nao criar patente no MVP evita:

- usuarios presos em rank por dados semi-verificaveis;
- comparacao global injusta;
- grind por volume;
- frustracao por reset mal definido;
- necessidade de suporte/manual review antes da hora.

### Como evitar grind e spam

Quando patentes existirem:

- score deve ter caps;
- desafios devem premiar variedade e qualidade;
- provas precisam de grau de confiabilidade;
- ranking global deve ser opcional e contextual;
- reset precisa ser previsivel;
- recompensas fortes exigem integridade mais alta.

## 7. Integridade competitiva

### Riscos principais

| Risco | Probabilidade | Impacto | Mitigacao MVP |
| --- | --- | --- | --- |
| Spam de posts | Alta | Alto | caps diarios e por desafio |
| `GAME_SESSION` falsa | Media | Alto | exigir post elegivel, janela e limite |
| `ACHIEVEMENT` declarativo | Alta | Medio | score limitado e classificacao como prova leve |
| Manipulacao entre amigos | Media | Medio | ranking local, sem recompensa forte |
| Ranking por volume | Alta | Alto | score por regra, nao por quantidade bruta |
| Comunidade farmando eventos | Media | Alto | guild ranking fora do MVP |
| Presence usada como prova | Alta | Alto | presence passiva proibida |
| Reactions/comments farmados | Alta | Medio | nao contar como score principal |
| Provider inconsistente | Media | Medio | nao depender de provider unico no MVP |

### Limites anti-spam

MVP deve definir:

- maximo de score por dia;
- maximo de score por tipo de prova;
- maximo de score por desafio;
- janela fixa de submissao;
- rejeicao de submissao duplicada;
- rejeicao de prova fora da janela;
- score recalculavel por regras deterministicas.

### Validacao minima de prova

Uma submissao deve conter:

- participante do desafio;
- usuario autenticado;
- tipo de prova permitido;
- referencia a post ou evento existente;
- ownership da prova;
- timestamp dentro da janela;
- status de revisao.

### Presence passiva

Presence nao conta.

Ela pode enriquecer um post `GAME_SESSION`, mas nao pode gerar score sem submissao persistida.

### Reactions/comments

Reactions e comments nao contam como score principal.

Podem virar sinais auxiliares no futuro, por exemplo para deteccao de spam ou tie-breaker social experimental, mas nao no MVP.

### Submissao invalida

Uma submissao deve ser rejeitada quando:

- referencia post de outro usuario;
- referencia post fora da janela;
- usa tipo de post nao permitido;
- referencia evento cancelado;
- referencia comunidade arquivada quando a regra exigir evento ativo;
- duplica uma prova ja usada no mesmo desafio;
- viola cap do desafio;
- esta malformada.

### Manipulacao entre amigos e comunidades

Ranking entre amigos reduz exposicao publica, mas nao elimina combinacao.

Por isso, MVP nao deve ter reward forte para ranking entre amigos.

Ranking de comunidade/guilda precisa esperar:

- roster;
- janela de inscricao;
- lock de membros;
- regra de score coletivo;
- auditoria futura.

## 8. Contratos e modelos futuros

Esta secao descreve modelos conceituais. Nao sao implementados nesta issue.

### MVP

#### ArenaChallenge

Representa um desafio jogavel.

Campos conceituais:

- `id`;
- `slug`;
- `title`;
- `description`;
- `startsAt`;
- `endsAt`;
- `status`: `DRAFT`, `ACTIVE`, `CLOSED`, `ARCHIVED`;
- `visibility`: `PUBLIC`, `FRIENDS`, `COMMUNITY`;
- `scope`: `INDIVIDUAL`, `FRIENDS`, `COMMUNITY`;
- `createdAt`;
- `updatedAt`.

#### ArenaChallengeRule

Define elegibilidade e pontuacao.

Campos conceituais:

- `id`;
- `challengeId`;
- `proofType`: `GAME_SESSION`, `ACHIEVEMENT`, `COMMUNITY_EVENT_RSVP`;
- `scoreValue`;
- `dailyCap`;
- `challengeCap`;
- `constraints`;
- `createdAt`;
- `updatedAt`.

#### ArenaParticipation

Representa entrada voluntaria no desafio.

Campos conceituais:

- `id`;
- `challengeId`;
- `userId`;
- `joinedAt`;
- `status`: `ACTIVE`, `WITHDRAWN`, `DISQUALIFIED`;
- `createdAt`;
- `updatedAt`.

#### ArenaSubmission

Representa uma prova submetida ou derivada.

Campos conceituais:

- `id`;
- `challengeId`;
- `participationId`;
- `userId`;
- `proofType`;
- `postId` opcional;
- `communityEventId` opcional;
- `communityEventRsvpId` opcional;
- `status`: `PENDING`, `ACCEPTED`, `REJECTED`;
- `scoreAwarded`;
- `submittedAt`;
- `reviewReason`;
- `createdAt`;
- `updatedAt`.

#### ArenaScore

Representa score por usuario e desafio.

Campos conceituais:

- `challengeId`;
- `userId`;
- `score`;
- `submissionCount`;
- `acceptedSubmissionCount`;
- `rejectedSubmissionCount`;
- `lastScoredAt`;
- `updatedAt`.

Pode nascer como read model recalculavel ou tabela materializada, dependendo do custo do primeiro slice.

### Arena 2.0 / futuras issues

#### ArenaSeason

Representa ciclo competitivo maior.

Campos conceituais:

- `id`;
- `slug`;
- `name`;
- `theme`;
- `startsAt`;
- `endsAt`;
- `status`;
- `resetPolicy`;
- `createdAt`;
- `updatedAt`.

#### ArenaRankSnapshot

Preserva estado final de ranking/patente.

Campos conceituais:

- `id`;
- `seasonId`;
- `userId`;
- `rank`;
- `tier`;
- `score`;
- `position`;
- `snapshotAt`.

#### ArenaReward

Representa recompensa competitiva emitida.

Campos conceituais:

- `id`;
- `seasonId`;
- `challengeId`;
- `userId`;
- `rewardType`;
- `rewardKey`;
- `issuedAt`;
- `expiresAt`;
- `revokedAt`.

#### ArenaTitle

Representa titulo competitivo equipavel.

Campos conceituais:

- `id`;
- `key`;
- `displayName`;
- `source`;
- `rarity`;
- `seasonId`;
- `expiresAt`.

#### ArenaBadge

Representa badge competitivo formal.

Campos conceituais:

- `id`;
- `key`;
- `displayName`;
- `source`;
- `seasonId`;
- `challengeId`;
- `revocable`;
- `createdAt`.

#### ArenaLeaderboard

Representa projection/snapshot de leaderboard.

Campos conceituais:

- `id`;
- `scope`;
- `scopeId`;
- `seasonId`;
- `challengeId`;
- `generatedAt`;
- `entries`.

No MVP, leaderboard pode ser derivado de `ArenaScore` sem tabela propria.

## 9. Superficies de produto

### MVP

Superficies recomendadas:

- `/arena`;
- detalhe do desafio;
- ranking local do desafio;
- filtro entre amigos;
- card compartilhavel;
- resumo pequeno no perfil;
- notificacao de encerramento ou resultado, se couber sem criar sistema novo.

### Futuro

Superficies de Arena 2.0:

- pagina de temporada;
- historico competitivo no perfil;
- badges e titulos no perfil;
- feed cards de vitoria;
- paginas de comunidade/guilda;
- paginas de evento comunitario;
- notification center com resultados;
- share cards de patente;
- leaderboard global;
- leaderboard por jogo;
- leaderboard por guilda.

### Fronteira com feed

Feed pode exibir provas e cards de resultado.

Feed nao deve calcular score.

### Fronteira com perfil

Perfil pode exibir reconhecimento.

Perfil nao deve ser fonte de verdade de ranking.

### Fronteira com comunidades

Comunidade pode hospedar ou contextualizar desafios.

Guild ranking/guild wars ficam fora do MVP.

### Fronteira com notificacoes

Notificacoes podem avisar:

- desafio ativo;
- desafio encerrado;
- resultado disponivel;
- submissao rejeitada.

Notificacao nao deve disparar score.

## 10. Vertical slice funcional recomendado

Titulo sugerido:

`feat(arena): implementar desafios semanais assincronos`

### Objetivo

Entregar a primeira Arena funcional sem ranking global, sem season formal e sem reward engine.

### Escopo recomendado

- criar modelo `ArenaChallenge`;
- criar modelo `ArenaChallengeRule`;
- criar modelo `ArenaParticipation`;
- criar modelo `ArenaSubmission`;
- criar score local por desafio;
- listar desafios ativos;
- usuario entra voluntariamente no desafio;
- usuario submete post `GAME_SESSION` ou `ACHIEVEMENT` como prova;
- validar ownership da prova;
- validar janela do desafio;
- aplicar score simples com caps;
- exibir ranking local do desafio;
- permitir filtro entre amigos;
- criar pagina `/arena`;
- gerar card compartilhavel simples.

### Fora de escopo do primeiro slice

- ranking global;
- temporada formal;
- patente;
- reward engine;
- guild wars;
- missoes em tempo real;
- economia;
- loja;
- rewards fortes;
- telemetria externa de partida.

### Criterios de aceite sugeridos

- usuario autenticado lista desafios ativos;
- usuario entra voluntariamente em desafio;
- usuario submete post elegivel do proprio usuario;
- submissao fora da janela falha;
- prova duplicada no mesmo desafio falha ou e idempotente;
- score respeita caps;
- ranking local deriva de score aceito;
- filtro entre amigos nao altera score;
- presence passiva nao pontua;
- challenge encerrado nao aceita nova submissao;
- UI explica regras, periodo, score e limites.

## 11. Decisoes finais da #237

- MVP usa ranking por desafio, nao ranking global.
- Ranking entre amigos e filtro/visao do desafio, nao ladder permanente.
- Ranking por comunidade/guilda fica fora do MVP.
- MVP nao precisa de season formal; desafio semanal e a unidade de ciclo.
- Recompensas do MVP sao fracas: cards, resumo, notificacao e destaque leve.
- Badges competitivos permanentes, titulos, patentes e rewards ficam para Arena 2.0.
- `UserStats`, profile badges atuais, reactions, comments e presence nao sao score competitivo.
- Score deve ser deterministico, limitado por caps e contextual ao desafio.
- Ranking global so deve existir depois de antifraude, snapshots, season e reward boundaries.
- A proxima issue funcional deve implementar desafios semanais assincronos.
