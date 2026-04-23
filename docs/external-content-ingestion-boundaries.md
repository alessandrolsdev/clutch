# Ingestao de conteudo externo - boundaries minimas

## Escopo

Este documento define quando conteudo externo realmente deve entrar no CLUTCH e qual e a fronteira correta entre provider externo, backend e frontend.

Nao implementa provider.
Nao adiciona endpoint em producao.
Nao cria pipeline de importacao.
Nao cobre outbound sharing.

Serve para fechar a `#236` e preparar uma futura issue de inbound pequeno e seguro, se ela continuar fazendo sentido.

## Fontes de verdade usadas

- `docs/sharing-growth-loops-matrix.md`
- `docs/shareable-clutch-units.md`
- `.codex/PROJECT.md`
- `frontend/CONTEXT.md` como referencia secundaria
- `frontend/src/schemas/feed.ts`
- `frontend/src/schemas/profile.ts`
- `frontend/src/services/integrations.ts`
- `backend/prisma/schema.prisma`
- `backend/src/api/routes/integrations.routes.ts`
- `backend/src/api/routes/profile.routes.ts`
- `backend/src/api/routes/posts.routes.ts`
- `backend/src/api/routes/uploads.routes.ts`
- `backend/src/core/services/integrations.service.ts`
- `backend/src/core/services/discord-oauth.service.ts`
- `backend/src/core/services/discord-presence.service.ts`

## Diagnostico do estado atual

### O que ja entra de fora hoje

O CLUTCH ja possui quatro tipos reais de entrada externa:

1. **vinculo de conta**
   - Discord OAuth
   - Steam connect
   - Epic connect

2. **import/sync de dados**
   - importacao de biblioteca Steam para `user_game_library`
   - importacao de biblioteca Epic para `user_game_library`

3. **ingestao operacional**
   - ingestao interna de presence Discord para `user_presence`

4. **URL ou midia fornecida manualmente pelo usuario**
   - `avatarUrl`
   - `bannerUrl`
   - `mediaUrl`
   - upload de imagem com URL publica do proprio CLUTCH

### O que isso significa no codigo atual

Hoje o produto ja consegue:

- persistir integracoes em `platform_integrations`
- importar biblioteca em `user_game_library`
- atualizar presence em `user_presence`
- aceitar URLs externas em campos de perfil e post

Mas o produto ainda nao possui:

- modelo de referencia externa por post
- modelo de referencia externa por perfil
- payload de feed com origem externa estruturada
- endpoint de ingestao social generica
- normalizacao de conteudo externo para o feed
- moderacao, ownership ou dedupe de conteudo vindo de fora

### O que e integracao real vs. apenas link/sync

| Fluxo | Categoria correta | Conteudo externo relevante? |
| --- | --- | --- |
| Discord OAuth | vinculo de conta | nao |
| Discord presence ingest | ingestao operacional | nao |
| Steam connect | vinculo + importacao de biblioteca | sim, mas apenas como biblioteca |
| Steam sync | importacao de biblioteca | sim, mas apenas como biblioteca |
| Epic connect | vinculo + importacao de biblioteca | sim, mas apenas como biblioteca |
| upload de imagem | midia enviada pelo usuario | nao e provider inbound |
| `avatarUrl` / `bannerUrl` / `mediaUrl` | URL manual | nao e modelo de ingestao |

Conclusao:

- o CLUTCH ja tem inbound de **dados de integracao e biblioteca**
- o CLUTCH ainda nao tem inbound de **conteudo social externo**

## Definicao minima

### O que e ingestao de conteudo externo relevante

Ingestao de conteudo externo relevante e a entrada de dado vindo de fora que:

- passa por uma boundary backend-side
- e validado e normalizado pelo CLUTCH
- ganha provenance explicita
- vira objeto persistido ou referencia estruturada do produto
- aparece para o usuario com proposito claro em perfil, feed ou showcase

### O que e apenas deep link ou reativacao

Nao e ingestao:

- abrir `/:username`
- abrir `/:username/library`
- cair no app por um link compartilhado
- voltar ao produto depois de um provider callback

Isso e reentrada, nao inbound de conteudo.

### O que e apenas vinculo de conta

Tambem nao e ingestao de conteudo:

- conectar Discord por OAuth
- registrar `externalId` em `platform_integrations`
- armazenar token ou metadata de provider

Isso e pre-condicao de integracao, nao conteudo do produto.

### O que nao deve entrar no estado atual

No estado atual, o produto nao deve aceitar como inbound:

- mirror de timeline de rede externa
- post bruto de provider social
- fetch de API externa direto do frontend
- importacao de URL arbitraria como post sem backend
- scraping ad hoc por provider
- conteudo externo sem provenance e sem ownership claro

## Cenarios inbound plausiveis

### 1. Biblioteca de jogos por provider conectado

Este cenario ja existe e e o melhor exemplo atual de inbound honesto.

Caracteristicas:

- backend obrigatorio
- normalizacao antes da persistencia
- dado externo vira parte estrutural do produto
- objetivo claro: enriquecer identidade e showcase

### 2. Atividade externa normalizada como contexto, nao como post bruto

Cenario plausivel para o futuro:

- atividade de jogo
- conquista
- referencia externa ligada a um jogo

Condicao minima:

- o CLUTCH nao deve espelhar o conteudo bruto do provider
- o backend deve traduzir isso para um shape proprio e pequeno

Exemplo valido:

- provider informa uma atividade gamer
- backend normaliza para uma referencia contextual do CLUTCH

Exemplo invalido:

- copiar o payload inteiro do provider para o feed

### 3. Referencia externa estruturada anexada pelo proprio usuario

Este e o melhor candidato para um slice futuro pequeno.

Caracteristicas:

- sem OAuth novo
- sem provider social complexo
- origem controlada pelo proprio usuario
- backend valida, canoniza e persiste uma referencia pequena

Exemplo de uso:

- usuario registra uma URL externa relevante ao proprio perfil ou showcase
- o CLUTCH persiste uma referencia externa estruturada, em vez de importar o conteudo bruto

### 4. Reentrada contextual por link

E plausivel como crescimento, mas nao conta como ingestao de conteudo externo.

Deve continuar separado conceitualmente.

## Cenarios nao plausiveis no estado atual

### Mirror de social feed

Trazer posts de outra rede para dentro do feed do CLUTCH como espelho direto e um passo grande demais e com acoplamento alto.

Problemas:

- ownership ambiguo
- moderacao complexa
- dependencias por provider
- baixo alinhamento com o produto atual

### Discord como fonte de conteudo social importado

Discord ja faz sentido no CLUTCH para:

- vinculo de conta
- identity metadata
- presence

Nao faz sentido hoje como fonte de conteudo social importado:

- mensagens nao sao landing publica do produto
- ownership e permissao sao dificeis
- uso social do Discord no CLUTCH ja esta melhor servido pela presence

### URL arbitraria virando post automaticamente

Sem boundary backend-side, isso mistura:

- ingestao
- renderizacao
- moderacao
- preview

em uma unica decisao fraca e dificil de sustentar.

## Boundary correta

### Quando o backend e obrigatorio

O backend passa a ser obrigatorio sempre que houver:

- token ou segredo de provider
- chamada a API externa
- validacao de dominio ou formato
- canonizacao de URL
- normalizacao de payload
- persistencia com provenance
- moderacao, allowlist ou dedupe

Se qualquer um desses pontos existir, o frontend nao deve resolver sozinho.

### O que jamais deve ser resolvido so no frontend

- consumir API externa diretamente do browser
- escolher provider por heuristica local e confiar nisso como fonte de verdade
- transformar URL externa em card final sem validacao backend-side
- persistir conteudo externo sem contract owner definido

### Como evitar acoplamento por provider

O provider deve ficar atras de um boundary com tres camadas:

`provider -> adapter/service backend -> modelo normalizado do CLUTCH -> frontend`

Regras:

- frontend consome apenas shape do CLUTCH
- backend esconde token, payload cru e regras de provider
- persistencia usa nomes semanticos do produto, nao campos crus do provider

### Onde ficam validacao, normalizacao e persistencia

- validacao: rota + service backend
- normalizacao: service/adapter backend
- persistencia: repository/modelos proprios
- renderizacao: frontend, sempre a partir do shape do CLUTCH

## Dependencias tecnicas

### O que ja cabe na arquitetura atual

- padrao rota fina + service + repository no backend
- precedentes de boundary em `integrations.service`, `discord-oauth.service` e `discord-presence.service`
- persistencia de integracao em `platform_integrations`
- persistencia de biblioteca em `user_game_library`
- uso de uploads proprios quando o CLUTCH precisar internalizar midia depois

### O que depende de contrato novo

- referencia externa estruturada em perfil ou post
- provenance explicita no payload
- status de ingestao ou validacao
- shape de leitura para frontend

### O que depende de provider externo

- qualquer importacao automatica
- qualquer leitura de API autenticada
- qualquer traducao de payload especifica por plataforma

### O que depende de nova modelagem de feed ou perfil

- exibir referencia externa como bloco proprio
- anexar inbound estruturado a post ou showcase
- separar conteudo nativo do CLUTCH de referencia externa

Hoje isso nao existe no contrato de `posts` nem de `profiles`.

## Riscos de acoplamento

1. tratar OAuth como se ja fosse ingestao de conteudo
2. importar conteudo bruto de provider e tentar renderizar direto
3. usar o frontend como parser de URL, provider e preview
4. misturar inbound de conteudo com share outbound
5. abrir uma modelagem generica demais antes de provar um cenario pequeno

## Vertical slice futuro recomendado

### Slice minimo recomendado

Se houver continuidade depois desta issue, o menor slice seguro e:

- manual
- backend-side
- sem provider social complexo
- fora do feed principal

### Escopo sugerido

1. permitir que o usuario envie uma URL externa como **referencia estruturada**
2. validar essa URL no backend contra uma allowlist pequena e explicita
3. persistir apenas:
   - URL canonica
   - provider identificado
   - titulo rotulado pelo CLUTCH ou label simples
   - owner e origem da referencia
4. exibir essa referencia primeiro no **perfil/showcase**, nao no feed

### Por que esse corte

- prova a boundary correta de ingestao
- nao depende de feed import
- nao depende de OAuth novo
- evita mirror de rede externa
- cria um shape reutilizavel para futuras referencias externas

### O que fica explicitamente para depois

- importacao automatica por provider
- anexar referencia externa a posts
- qualquer mirror de conteudo social
- pipeline de preview rico ou scraping
- tratamento cross-provider mais amplo

## Fronteira com #234 e #235

- `#234` definiu inbound vs. outbound
- `#235` priorizou outbound em `/:username` e `/:username/library`
- esta issue trata apenas de **quando e como conteudo externo deve entrar**

Ela nao reabre:

- metadata publica de share
- CTA outbound
- provider-specific share

## Decisoes desta issue

- deep link, OAuth e reativacao nao contam como ingestao de conteudo externo
- Steam e Epic ja sao exemplo de inbound honesto, mas restrito a biblioteca
- Discord e integracao operacional e de identidade, nao candidato atual a inbound social
- qualquer inbound relevante futuro deve passar por backend, com normalizacao e provenance
- o primeiro slice futuro, se existir, deve ser referencia externa estruturada em perfil/showcase, nao importacao de feed
