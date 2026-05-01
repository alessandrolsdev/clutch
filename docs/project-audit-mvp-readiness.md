# Auditoria do projeto e prontidão MVP

Data da auditoria: 2026-05-01  
Base auditada: `origin/develop` em `ed8086b` (`Merge pull request #299 from alessandrolsdev/feature/arena-weekly-challenges`)  
Escopo: auditoria documental, sem alteração de código, contrato ou regra de negócio.
Validação adicional: smoke Docker via `docker compose up -d --build`, `container-bootstrap.sh`, proxy Traefik e contratos HTTP reais.

## 1. Resumo executivo

O CLUTCH saiu das últimas entregas com um conjunto de verticais de produto bem mais completo do que a documentação raiz indica. Em `develop` já existem auth social, connected accounts, Connection Center, Steam OpenID, MyAnimeList OAuth/import/showcase opt-in, comunidades com eventos, arquivamento e o primeiro slice funcional de Arena. A arquitetura por camadas no backend está consistente: rotas, services, repositories, provider registry e Prisma estão relativamente bem separados.

O estado não é "pronto para beta" sem hardening. O maior risco concreto encontrado é de segurança/observabilidade: o callback de login social registra URLs com query e o smoke Docker confirmou `code` e `state` aparecendo em logs da stack, enquanto o log gate atual não bloqueia esse padrão. Há também fragilidade operacional em stores OAuth/PKCE em memória, documentação defasada em `README.md`, `.codex` e alguns docs de arquitetura, cobertura completa local instável e ausência de runbook de deploy/smoke para providers reais.

O MVP é demonstrável em ambiente controlado, com Docker/Postgres/Redis e mocks/secrets corretos. Para beta fechado, eu trataria antes os riscos de log sensível, CI/coverage, documentação/env/runbook e uma revisão objetiva de UX mobile/acessibilidade das superfícies principais.

## 2. Estado real do backlog

Consulta GitHub em 2026-05-01:

- Issues abertas: nenhuma encontrada via `gh issue list --state open`.
- PRs abertas: nenhuma encontrada via `gh pr list --state open`.
- Epics/arquitetura recentes fechados:
  - #270 Auth Social & Connected Accounts.
  - #214 Comunidades, guildas e pertencimento.
  - #213 Gamificação competitiva, jornadas e Modo Arena.
  - #223 Arquitetura macro do Modo Arena, via PR #296.
  - #237 Ranking, temporadas e recompensas Arena, via PR #297.
- Entregas recentes em `develop`:
  - #279 providers/identities foundation.
  - #280 login social Google/Discord.
  - #281 account linking/unlink/reauth.
  - #282 Connection Center.
  - #283 visibilidade de contas conectadas.
  - #284 matriz de testes auth/providers/Connection Center.
  - #285 Steam/MyAnimeList no registry/Connection Center.
  - #287 Steam OpenID ownership proof.
  - #289 MyAnimeList OAuth2/PKCE.
  - #291 import inicial MyAnimeList.
  - #293 showcase otaku opt-in.
  - #294 arquivamento e slug único de comunidades.
  - #295 reentrega de eventos comunitários mínimos em `develop`.
  - #299 Arena weekly challenges.

Inconsistências encontradas:

- A trilha de eventos comunitários foi corrigida por #295. A PR #269 tinha sido mergeada fora de `develop`, mas o código real agora está em `develop`.
- O backlog está "limpo demais": zero issues abertas significa que riscos técnicos reais ainda não estão rastreados.
- `README.md`, `.codex/PROJECT.md`, `.codex/BLUEPRINT-ATUAL.md`, `docs/arena-mode-architecture.md`, `docs/arena-ranking-seasons-rewards.md` e `docs/steam-myanimelist-connection-scope.md` têm drift em relação ao código atual.

Follow-ups necessários estão listados na seção 13, sem criação automática de issues nesta auditoria.

## 3. Arquitetura geral

Classificação geral: aceitável, com pontos saudáveis e alguns pontos frágeis antes de beta.

Saudável:

- Backend Fastify/TypeScript está organizado por `routes`, `core/services`, `core/repositories`, provider registry e Prisma.
- Frontend Next.js usa App Router, `services` e `schemas` por domínio.
- Regras sensíveis recentes ficam no backend: ownership externo, visibility pública, unlink seguro, reauth, score Arena, arquivamento de comunidade, RSVP e showcase opt-in.
- Provider boundary evoluiu bem: Google/Discord social, Steam OpenID, MyAnimeList OAuth2/PKCE e connected accounts compartilham foundation.
- Prisma schema contém constraints importantes:
  - `PlatformIntegration` único por `(userId, platform)` e `(platform, externalId)`.
  - `Community.slug` único.
  - `CommunityMember` único por `(communityId, userId)`.
  - `CommunityEventRsvp` único por `(eventId, userId)`.
  - `ArenaParticipation` único por `(challengeId, userId)`.
  - `ArenaSubmission` único por `(challengeId, proofType, proofId)`.
  - `MediaTitle` único por `(externalSource, externalId, kind)`.

Aceitável:

- O padrão route/service/repository é consistente, embora alguns repositories ainda concentrem selects e transformação de payload.
- Arena calcula leaderboard derivado de submissions em memória. Isso é aceitável no MVP, mas deve ser limitado/paginado antes de volume maior.
- Seeds são úteis para demo, mas ainda não substituem operação real de desafios Arena.
- `frontend/CONTEXT.md` está mais próximo da realidade atual que o `README.md` e `.codex/PROJECT.md`.

Frágil:

- Stores de `state` OAuth/PKCE são em memória. Isso funciona em single-instance e testes, mas quebra callback se houver restart ou múltiplas instâncias sem sticky session.
- Documentação operacional de provider secrets, callbacks, smoke real e deploy ainda está espalhada.
- Full coverage local mostrou histórico recente de falha por dependência de Postgres/Redis/timeouts, mesmo com testes focados passando.
- Logging seguro depende de disciplina por rota; há caso concreto de `request.url` em callback OAuth social.

Precisa correção antes do MVP/beta:

- Sanitizar logs de callback OAuth/social para não registrar `code` e `state`.
- Atualizar documentação e runbooks de execução/deploy/providers.
- Estabilizar cobertura/CI ou documentar claramente a matriz local vs CI.

## 4. Auditoria de contratos backend/frontend

Legenda: `coerente`, `risco`, `incompleto`.

| Contrato | Estado | Observações |
| --- | --- | --- |
| Auth/session/refresh/logout | coerente com risco | Backend direto emite token no body, mas o contrato browser via frontend proxy validado no Docker grava `clutch_session` e `clutch_refresh` em cookies HTTP-only e não retorna token no body. Refresh rotation existe. O risco principal é log de callback OAuth, não o contrato de sessão em si. |
| Social login Google/Discord | risco | Backend valida state TTL/consumo único e ownership por external identity. Porém `auth.routes.ts` registra `request.url` no sucesso do callback social, o que pode vazar `code`/`state` em logs. |
| Connected accounts | coerente com risco baixo | Backend expõe providers/capabilities e contas por usuário. Tokens não aparecem. O contrato privado ainda inclui `externalId`, que pode ser reduzido se a UI não precisar dele. |
| Providers/capabilities | coerente | Registry diferencia social login, OAuth connect, OpenID, import e experimental. Frontend consome capabilities do backend. |
| Visibility/privacy | coerente | `publicProfileVisible=false` por default. Perfil público filtra `isActive`, `publicProfileVisible`, `CONNECTED`, `OFFICIAL` e só retorna provider/connectionType/displayName. |
| Profile público | coerente com overfetch legado | Rota usa `findFullProfileByUsername`, que não retorna `externalId` nem metadata de connected accounts. O método legado `findByUsername` ainda faz include de `externalId`/`metadata` sem retornar, o que é overfetch e risco futuro se reutilizado. |
| Feed/posts | aceitável | `GAME_SESSION` e `ACHIEVEMENT` existem e já alimentam Arena. Presence/reactions/comments não entram como score Arena. |
| Friends/social continuity | aceitável | Modelo existe e profile agrega summary. Precisa mais smoke de UX e testes ponta a ponta. |
| Steam/Discord/Epic/MyAnimeList | coerente com dependências externas | Steam tem OpenID ownership, MAL OAuth2/PKCE/import, Epic segue experimental. Validação real depende de secrets e callbacks externos. |
| MyAnimeList import/showcase | coerente | Import é manual, primeira página, privado por default, showcaseRank opt-in. Chave `MediaTitle` inclui source, externalId e kind, evitando colisão anime/manga. |
| Communities | coerente | Slug único, arquivamento, membership e public listing estão em backend. |
| Community events/RSVP | coerente | Modelos e rotas existem em `develop`; criação/cancelamento/RSVP respeitam permissões e comunidade arquivada segundo a entrega #295. |
| Arena challenges/leaderboard | coerente para MVP | Ranking local do desafio, prova por post `GAME_SESSION`/`ACHIEVEMENT`, cap e janela ativa. Sem ranking global, como planejado. |
| Notifications/presence | aceitável com risco | Presence usa token em query para websocket conforme `.codex/SECURITY.md`; isso exige redaction forte em logs/reverse proxy. |
| Uploads/media | incompleto nesta auditoria | Rotas existem, mas não foi feita validação profunda de storage, tipos MIME, tamanho e antivírus. Deve entrar em hardening antes de beta público. |

Validação Docker de contratos reais:

- Stack subiu com `docker compose up -d --build`.
- `docker compose exec -T backend sh ./scripts/container-bootstrap.sh` aplicou migrations e seed sem pendências.
- Passaram via proxy/Traefik:
  - `GET /api/health`.
  - `GET /api/health/ready`.
  - `GET /presence/health`.
  - `GET /login`.
  - `POST /api/auth/login` com cookies `clutch_session` e `clutch_refresh`, sem token no body do frontend proxy.
  - `GET /api/auth/me`.
  - `GET /api/auth/presence-token`.
  - `GET /api/auth/connected-accounts` sem `accessToken`/`refreshToken`.
  - `GET /api/profiles/clutchplayer` sem `externalId`/`metadata` de connected accounts.
  - `GET /api/communities` e `GET /api/communities/:slug/events`.
  - `GET /api/otaku/library`.
  - `GET /api/arena/challenges`, detalhe por slug e leaderboard.
  - Callback social inválido redirecionou sem propagar `code`/`state` na URL final.
- Falha de segurança observada: logs da stack registraram `code`/`state` de callback e o log gate não detectou.

Contratos com maior risco de drift:

- Connected accounts: `externalId` no contrato privado do owner pode se tornar dependência de UI sem necessidade.
- Arena: frontend schema aceita `COMMUNITY_EVENT_RSVP` como enum de proof type, mas request de submissão aceita só `GAME_SESSION`/`ACHIEVEMENT`. Isso está alinhado ao futuro, mas precisa copy clara para não sugerir evento como prova agora.
- Docs de Arena ainda descrevem ausência de modelos/endpoints em partes do texto, embora #299 tenha implementado o primeiro slice.

## 5. Auditoria de segurança e privacidade

Achados críticos/P1:

1. Callback de login social pode registrar `code` e `state` em logs.
   - Evidência: o smoke Docker chamou `/api/auth/social/google/callback?code=contract-smoke-code&state=contract-smoke-state`; a resposta final redirecionou de forma segura para `/login`, mas logs de frontend Next dev e backend registraram a URL com query. O log gate `scripts/ci/check-sensitive-logs.mjs` retornou sucesso mesmo com `code=` e `state=` presentes no arquivo de logs.
   - Impacto: OAuth authorization code e state podem aparecer em logs de aplicação, CI ou agregadores, violando a regra do projeto de não expor `code`/`state`.
   - Recomendação: trocar logs para path sanitizado sem query no backend/frontend, ajustar o log gate para bloquear `code`, `state`, `token` em query string e adicionar teste específico.

2. Smoke de websocket imprime token de presença no stdout do helper.
   - Evidência: `scripts/ci/validate-presence-handshake.mjs` imprime a URL completa `ws://localhost/ws/presence?token=...` durante a conexão.
   - Impacto: token de acesso temporário pode aparecer em logs de CI/local.
   - Recomendação: mascarar query token no helper e ampliar o log gate para tokens em query string.

3. Stores OAuth/PKCE em memória limitam segurança operacional em produção escalada.
   - Evidência: `createInMemorySocialOAuthStateStore`, state store de account connection e PKCE store em memória.
   - Impacto: callbacks falham após restart e podem quebrar em múltiplas instâncias. Não é vazamento direto, mas é fragilidade operacional de auth.
   - Recomendação: mover para Redis ou storage compartilhado com TTL/consumo atômico antes de beta escalado.

Achados médios:

- Connected accounts retornam `externalId` no contrato autenticado de `GET /auth/connected-accounts`. Não é perfil público, mas é dado de identidade externa. Se a UI não precisa, deve ser removido ou mascarado.
- Presence por websocket com token em query exige redaction em logs de proxy, access logs e ferramentas de observabilidade. A documentação de segurança já alerta, mas falta runbook operacional.
- `profileRepository.findByUsername` faz overfetch de `externalId` e `metadata` de integrações ativas. A rota pública usa método seguro, mas overfetch legado aumenta risco de regressão futura.
- `UserMediaEntry.showcaseRank` é validado por service e normalizado em transação, mas não há evidência no schema de constraint parcial para rank único/range. O service está correto para MVP; DB hardening pode reduzir risco de corrida futura.
- Arena leaderboard é derivado no backend, mas a pontuação competitiva ainda depende de posts auto-reportados. Isso é esperado no MVP, mas deve permanecer com recompensa fraca.

Achados baixos:

- `README.md` e `.codex` desatualizados podem levar setup incorreto e validação falsa.
- Root `.env.example` ainda contém defaults dev explícitos. Isso é comum em desenvolvimento, mas precisa runbook de produção com segredos obrigatórios e check de env.
- Uploads/media precisam revisão de segurança própria: tipo/tamanho/storage/logging.

Pontos positivos:

- Tokens externos são persistidos server-side via foundation de connected accounts e não aparecem em contratos públicos.
- `PlatformIntegration.publicProfileVisible` é privado por default.
- Perfil público não expõe `externalId`, metadata, raw provider payload ou tokens.
- MyAnimeList import não publica dados automaticamente.
- Arena rejeita presence/reactions/comments como prova e valida ownership do post.
- Community archive é fonte de verdade no backend, não apenas UI.

## 6. Auditoria backend

Auth/providers:

- Estado: saudável com hardening pendente.
- Foundation de identities está boa: `externalId` obrigatório, uniqueness global por provider, ownership conflict mapeado para erro de domínio.
- Social login evita takeover por email, usando externalId como identidade primária.
- Ponto frágil: logs de request com query sensível em callback social e stores em memória.

Profile:

- Estado: aceitável.
- Perfil público usa select seguro para connected accounts.
- Social continuity e otaku showcase são agregados no endpoint público.
- Ponto frágil: método legado com overfetch de integration metadata/externalId.

Feed/posts:

- Estado: aceitável.
- `GAME_SESSION` e `ACHIEVEMENT` são tipos de post e foram reutilizados pela Arena.
- Risco: prova Arena ainda depende de atividade declarada pelo usuário; não deve gerar recompensa forte.

Friends/social continuity:

- Estado: funcional, precisa smoke.
- O domínio está integrado ao profile.
- Falta validação E2E de UX e regressão de componentes sociais.

Communities/events:

- Estado: quase pronto para MVP.
- Modelos `Community`, `CommunityMember`, `CommunityEvent`, `CommunityEventRsvp` estão em `develop`.
- Slug único, archive e eventos mínimos estão rastreados.
- Ações sensíveis são protegidas por service/backend.
- Fora do MVP: moderação avançada, chat, recorrência, calendário complexo.

Otaku/MyAnimeList:

- Estado: quase pronto.
- MAL OAuth2/PKCE, import inicial e showcase opt-in estão alinhados com privacidade.
- `MediaTitle` usa `(externalSource, externalId, kind)` e evita colisão entre anime/manga.
- Ponto a reforçar futuramente: constraints DB para showcase rank, se a feature crescer.

Arena:

- Estado: primeiro slice funcional entregue.
- Modelos mínimos existem: `ArenaChallenge`, `ArenaParticipation`, `ArenaSubmission`.
- Score é server-side, fixo por desafio, com cap e janela ativa.
- Leaderboard é local por desafio e ordena por score, `lastSubmissionAt` e username.
- Ponto frágil: criação/gestão de desafios depende de seed ou manipulação direta; sem backoffice/admin/runbook o produto não opera Arena semanal com segurança.

Presence/notifications:

- Estado: funcional com risco operacional.
- Notifications têm domínio próprio.
- Presence depende de websocket/token; precisa redaction e validação de proxy/logs.

Migrations/constraints:

- Recentes migrations estão alinhadas às features entregues.
- Não foi encontrada migration destrutiva óbvia nesta auditoria.
- Áreas candidatas a constraint adicional: showcase rank por usuário e limites de integridade que hoje vivem só em service.

Testes/coverage:

- Há suites por domínio, mas histórico local recente indica cobertura completa instável por dependências e timeouts.
- CI tem Postgres/Redis services e coverage global, mas auditoria não rodou build/test por ser alteração somente documental.
- Recomendação: estabilizar test matrix e documentar execução local confiável antes de beta.

## 7. Auditoria frontend

Classificação por superfície:

| Superfície | Estado | Observações |
| --- | --- | --- |
| Landing/login/register | funcional mas precisa polish | Fluxos existem. Social login está integrado. Precisa revisão de erros, acessibilidade e mobile real. |
| Feed | funcional | Base social existe. Precisa smoke de criação/erro/loading e consistência visual. |
| Profile público | quase pronto | Exibe profile, library/social/otaku. Contrato público é seguro. Precisa validar mobile e empty states de usuário novo. |
| Library | funcional mas precisa validação | Existe rota pública. Precisa garantir estado vazio, responsivo e coerência com dados importados. |
| Settings/integrations | quase pronto | Connection Center usa backend capabilities. Precisa reduzir dependência visual de dados sensíveis como externalId e reforçar estados de provider indisponível. |
| Connection Center | quase pronto | Conectar/reconectar/desconectar/visibility/import MAL existem. Precisa smoke com callbacks reais/mocks e estados de erro. |
| Otaku showcase manager | quase pronto | Opt-in explícito e limite de 3. Precisa revisão mobile e UX de limite atingido. |
| Communities | quase pronto | Listagem/detalhe/archive/membership existem. Precisa polish de estados e responsividade. |
| Community detail/events | funcional | Eventos mínimos aparecem. Precisa validar empty/cancelado/arquivado em mobile. |
| Arena | funcional MVP | Lista, detalhe, join, submissão e leaderboard existem. Copy não deve sugerir ranking global/recompensa. Precisa dados operáveis além de seed. |
| Navbar/sidebar | funcional com risco de polish | Muitas superfícies novas foram adicionadas rapidamente. Precisa revisão de densidade, active states, mobile e acessibilidade. |
| Error/loading/empty states | desigual | Existem em várias páginas, mas a consistência ainda parece variável. |

Pontos de frontend positivos:

- Schemas Zod por domínio reduzem drift.
- Services centralizam API calls e parsing.
- Connection Center consome provider capabilities do backend em vez de inventar fonte própria.
- UI de privacidade/otaku não publica dados por default.

Pontos frágeis:

- Testes frontend completos tiveram histórico recente de timeouts/flakes em componentes principais.
- O produto tem muitas superfícies novas; falta uma rodada horizontal de UX/mobile/acessibilidade.
- Callbacks e flows OAuth precisam smoke real/mocado documentado.
- O frontend ainda aceita/parseia alguns campos que talvez não precise renderizar (`externalId` em integrations).

## 8. Auditoria de documentação

Docs confiáveis:

- `frontend/CONTEXT.md`: relativamente atualizado e já menciona Arena, connected accounts e contratos recentes.
- `docs/community-membership-governance-model.md`: ainda útil como contexto arquitetural.
- `docs/community-events-rsvp-model.md`: útil, agora alinhado após #295.
- `docs/anime-otaku-social-domain.md`, `docs/anime-profile-showcase-plan.md`, `docs/anime-social-activity-feed-boundary.md`: úteis para separar import/showcase/feed.

Docs com drift:

- `README.md`: diz que `/[username]/library`, global `error/loading/not-found` e Discord OAuth estavam ausentes, mas o código atual já tem rotas e auth social/connected accounts. Também não reflete communities, Arena, Connection Center, MAL e Steam OpenID.
- `.codex/PROJECT.md`: descreve produto parcial anterior e não reflete a entrega completa de auth providers, comunidades, Arena, MAL import/showcase.
- `.codex/BLUEPRINT-ATUAL.md`: gerado em 2026-04-10; útil historicamente, mas desatualizado depois das entregas de fim de abril/maio.
- `docs/arena-mode-architecture.md`: correto como arquitetura, mas partes de diagnóstico agora são históricas, pois #299 implementou os modelos/endpoints Arena.
- `docs/arena-ranking-seasons-rewards.md`: correto como arquitetura, mas o "primeiro slice recomendado" já foi entregue.
- `docs/steam-myanimelist-connection-scope.md`: desatualizado para MAL; hoje já existe OAuth2/PKCE e import inicial.

Docs faltantes ou insuficientes antes do MVP:

- Runbook de OAuth/providers com envs, callback URLs, smoke manual e troubleshooting.
- Runbook de deploy/beta: Docker, Postgres, Redis, migrations, seed, secrets, health checks.
- Documento de smoke E2E para fluxos críticos.
- Política prática de logging/redaction para callbacks OAuth, websocket query token e headers sensíveis.
- Guia operacional de Arena: como criar/ativar desafios semanais sem painel admin.

## 9. MVP readiness

| Área | Estado | Motivo |
| --- | --- | --- |
| Auth | precisa hardening | Funcional, mas log OAuth e state in-memory precisam correção/decisão antes de beta. |
| Onboarding | precisa UX polish | Login/register existem; onboarding de perfil/conexões não está maduro. |
| Profile | quase pronto | Perfil público, library, connected accounts públicos e otaku showcase existem. |
| Feed | quase pronto | Base funcional; precisa smoke E2E e polish. |
| Integrations | quase pronto | Steam/MAL/Discord/Google/Epic tratados; depende de secrets reais e runbook. |
| Communities | quase pronto | MVP de membership/eventos/archive está em `develop`. |
| Arena | precisa hardening | Primeiro slice funcional existe, mas operação depende de seed e score é leve/semi-verificável. |
| Otaku | quase pronto | MAL import e showcase opt-in funcionam conceitualmente; falta smoke real e polish. |
| Presence | precisa hardening | Funcional, mas token em query exige redaction/proxy discipline. |
| Notifications | funcional mas precisa teste | Domínio existe; frontend teve histórico de teste instável. |
| Settings | quase pronto | Connection Center é central, precisa polish/erros reais. |
| Mobile | precisa revisão | Muitas telas novas, sem evidência de QA visual/mobile horizontal. |
| Deploy/env | precisa hardening | Env examples existem, mas runbook de produção/beta está incompleto. |
| CI/test/coverage | precisa hardening | CI existe; execução local full coverage recente foi instável. |
| Observability/logging | bloqueador antes de beta | Log de callback OAuth com query é risco concreto. |
| Seed/demo data | precisa hardening | Arena depende de seed/admin futuro; demo precisa roteiro claro. |

Pode ser demonstrado hoje em ambiente controlado:

- Login email/senha.
- Social login com mocks/secrets configurados.
- Feed com posts e tipos gamer.
- Profile público, library e showcase otaku.
- Connection Center e conexões Steam/MAL/Discord/Google conforme env.
- Import MAL com mocks/secrets.
- Comunidades, eventos e RSVP.
- Arena weekly challenge com dados seedados.

Depende de secrets reais:

- Google OAuth.
- Discord OAuth/social/connect.
- Steam OpenID e Steam Web API para biblioteca.
- MyAnimeList OAuth2/PKCE e API.
- IGDB/Epic, conforme integração ativa no ambiente.

Depende de Docker/infra:

- Postgres.
- Redis.
- Backend Fastify.
- Frontend Next.
- Presence service/websocket.

Impedimentos para beta fechado:

- Corrigir log de callback OAuth com `code`/`state` e token de presença em smoke helper.
- Definir state/PKCE store compartilhado ou documentar single-instance como limite explícito.
- Estabilizar CI/coverage e smoke local.
- Atualizar docs/runbooks de env, callbacks e deploy.
- Rodada mobile/acessibilidade nas superfícies principais.

Coisas que seriam ruins mostrar a usuário real:

- Erros OAuth pouco explicáveis sem runbook/config correta.
- Arena sem operação clara de desafios semanais.
- Estados vazios/polish inconsistentes em mobile.
- Docs de setup dizendo que features atuais não existem.

Coisas que podem quebrar em produção:

- OAuth callback após restart ou em múltiplas instâncias.
- Logs com query sensível em callback e token de presence impresso por helper de smoke.
- Provider externo sem env/callback correto.
- Tests/coverage se Postgres/Redis não estiverem prontos ou timeouts de frontend persistirem.
- Leaderboard Arena sem paginação se volume crescer.

## 10. Riscos priorizados

P0/P1:

1. Log de `code`/`state` OAuth no callback social e log gate cego para query sensível.
2. Smoke helper de presence imprimindo token de acesso em stdout.
3. Falta de runbook confiável de env/callback/deploy para providers reais.
4. Coverage/test matrix instável para validação de beta.

P1/P2:

5. State OAuth/PKCE em memória para ambiente multi-instance.
6. Documentação raiz e `.codex` divergindo do produto real.
7. Arena sem mecanismo operacional claro para criar/ativar desafios.
8. Revisão mobile/acessibilidade pendente nas superfícies novas.

P2:

8. Exposição desnecessária de `externalId` no contrato autenticado de connected accounts.
9. Overfetch legado de `metadata`/`externalId` em profile repository.
10. Constraints DB adicionais para showcase rank e alguns invariantes hoje mantidos só no service.

## 11. Próximos caminhos possíveis

### A. MVP/Beta readiness

Objetivo: tornar o produto executável e validável por usuários reais em ambiente fechado.

Valor: reduz risco operacional e evita demo instável.

Risco: menos visível como feature nova, mas é o caminho com maior impacto para beta.

Esforço: médio.

Dependências: Docker/CI, secrets reais, smoke scripts, revisão de envs.

Atacar agora porque o backlog está sem issues abertas e os principais riscos são de readiness, não de feature.

### B. Frontend polish e UX consistency

Objetivo: revisar mobile, acessibilidade, estados vazios/erro/loading e consistência das superfícies entregues.

Valor: melhora percepção de produto e reduz fricção em beta.

Risco: pode virar redesign se o escopo não for rigidamente limitado.

Esforço: médio/alto.

Dependências: matriz de telas, dados seedados e browser QA.

Atacar depois do hardening P0/P1 de segurança/logging.

### C. Segurança/contratos/hardening

Objetivo: reduzir risco de vazamento, drift e concorrência nos contratos críticos.

Valor: protege auth/providers/visibility/Arena antes de expor para usuários reais.

Risco: pode fragmentar em muitas correções pequenas se não agrupar.

Esforço: médio.

Dependências: testes focados, logs, Redis/store compartilhado, revisão de contracts.

Atacar junto com A, começando pelo log OAuth.

## 12. Recomendação final

Recomendação principal: seguir pelo caminho A, com foco explícito em Segurança/Contratos dentro do ciclo de MVP/Beta readiness.

Não recomendo abrir novo ciclo de features agora. O produto já acumulou muitas entregas recentes e o risco maior está na camada operacional: logs sensíveis, callbacks reais, envs, CI/coverage, smoke E2E e documentação. Uma semana de hardening e documentação operacional deve gerar mais valor que adicionar outra vertical.

Ordem sugerida:

1. Corrigir log sensível de OAuth social e token de presence no smoke helper.
2. Atualizar docs/runbooks de setup, deploy, providers e smoke.
3. Estabilizar coverage/smoke E2E.
4. Revisar mobile/acessibilidade das superfícies MVP.
5. Só então avançar em novas features ou Arena 2.0.

## 13. Lista curta de issues sugeridas

### 1. `fix(security): sanitizar logs de callbacks OAuth e presence smoke`

- Tipo: `bug`
- Prioridade: P0
- Motivo: smoke Docker confirmou `code`/`state` em logs de callback social, o log gate não bloqueou esse padrão e o helper de websocket imprime token na URL de conexão.
- Escopo mínimo: substituir logs por path sem query, revisar callbacks social/link/reauth/Discord legado, mascarar token no helper de presence e ampliar log gate para `code`, `state`, `token`, `access_token`, `refresh_token` em query string.
- Critério de aceite: nenhum log de callback ou smoke contém query sensível; testes focados passam; scanner de logs sensíveis bloqueia OAuth code/state e token em query.

### 2. `docs(ops): atualizar runbook de setup, providers e deploy beta`

- Tipo: `docs`
- Prioridade: P1
- Motivo: README e `.codex` estão defasados e não há runbook unificado para secrets/callbacks/smoke.
- Escopo mínimo: atualizar README, `.codex/PROJECT.md` ou documento operacional, envs obrigatórias, callbacks Google/Discord/Steam/MAL, Docker/Postgres/Redis, migrations, seed e smoke.
- Critério de aceite: novo dev consegue subir stack e validar fluxos principais seguindo docs; docs não contradizem features atuais.

### 3. `test(ci): estabilizar coverage completo backend e frontend`

- Tipo: `test`
- Prioridade: P1
- Motivo: histórico recente de full coverage local instável por Postgres/Redis/timeouts.
- Escopo mínimo: revisar suites lentas/flaky, readiness de dependências, timeouts, mocks e separação de testes focados vs full coverage.
- Critério de aceite: `npm run test:coverage` backend/frontend tem caminho local documentado e CI confiável sem baixar threshold.

### 4. `chore(auth): mover state OAuth e PKCE para store compartilhado`

- Tipo: `chore`
- Prioridade: P1
- Motivo: stores em memória limitam callbacks em ambiente multi-instance/restart.
- Escopo mínimo: usar Redis ou store compartilhado com TTL e consumo atômico para social auth, account linking, Steam OpenID e MAL PKCE.
- Critério de aceite: state/PKCE sobrevivem a múltiplas instâncias conforme desenho; state continua one-time; testes cobrem expiração/reuso.

### 5. `chore(security): reduzir exposição de externalId em connected accounts`

- Tipo: `chore`
- Prioridade: P2
- Motivo: `externalId` aparece no contrato autenticado e nos schemas frontend, mas pode não ser necessário para UI.
- Escopo mínimo: avaliar uso real, remover/mascarar do contrato se possível e manter apenas dados de display/capability/status.
- Critério de aceite: Connection Center funciona sem externalId bruto; perfil público segue sem externalId; testes atualizados.

### 6. `feat(arena): adicionar operação mínima de desafios semanais`

- Tipo: `feat`
- Prioridade: P1
- Motivo: Arena já tem primeiro slice, mas depende de seed/manipulação direta para criar desafios.
- Escopo mínimo: definir caminho operacional mínimo para criar/ativar/encerrar desafios, sem ranking global, temporada formal ou reward engine.
- Critério de aceite: operador consegue preparar desafio semanal por fluxo documentado ou endpoint/admin mínimo protegido; usuários veem apenas desafios ativos.

### 7. `test(e2e): criar smoke beta dos fluxos críticos`

- Tipo: `test`
- Prioridade: P1
- Motivo: há muitas verticais novas e pouca evidência de jornada ponta a ponta.
- Escopo mínimo: smoke container/local para auth, feed, profile, Connection Center, communities/events, otaku import/showcase e Arena.
- Critério de aceite: smoke roda com mocks/seeds sem provider real e documenta limitações para OAuth real.

### 8. `chore(ui): revisar mobile e acessibilidade das superfícies MVP`

- Tipo: `chore`
- Prioridade: P2
- Motivo: muitas páginas novas foram adicionadas rapidamente e precisam QA horizontal.
- Escopo mínimo: revisar login/register, feed, profile/library, settings/integrations, communities/events, otaku showcase e Arena em mobile, keyboard, headings, focus e empty/error states.
- Critério de aceite: sem overflow óbvio, headings claros, CTAs acessíveis, estados vazios/erro consistentes e screenshots/smoke documentados.
