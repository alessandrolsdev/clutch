# Direção visual e motion do CLUTCH

## Diagnóstico

A inspeção do código cobriu landing, autenticação, navegação, feed, perfil, biblioteca, comunidades, arena, notificações e configurações. As superfícies repetiam cards arredondados e hierarquias semelhantes. A landing apresentava detalhes de infraestrutura ao jogador e a prévia usava placeholders de arte.

## Implementação

Identidade editorial gamer: preto mineral, violeta, verde ácido e menta; Barlow para leitura e Barlow Condensed para títulos. Hero com sentinela vetorial original, órbitas, fragmentos e parallax limitado. Faixa tipográfica contínua, três ilustrações geométricas e perfil demonstrativo identificado. Tokens, cards, botões e navegação propagam a linguagem às rotas internas.

A referência B3ZL não foi identificada e esta implementação não afirma reproduzi-la. O Morphed retornou zero créditos; nenhum asset foi gerado pelo serviço. A arte desta entrega é SVG/CSS no código.

## Responsabilidades

- `src/styles/tokens.css` e `src/styles/gamer.css`: paleta, formas, responsividade e coreografia.
- `src/components/landing/*`: composição pública, prévia e sentinela com parallax.
- `src/components/ui/motion-environment.tsx`: preferência do sistema e pausa manual entre navegações.
- Layouts, navbar, card e button: aplicação visual compartilhada.
- `src/components/profile/presence-badge.tsx`: integração com a pausa global.
- Testes de landing e motion: links, identificação da demonstração, pausa, preferência dinâmica e limpeza de listeners.

## Motion e limites

- Personalidade energética; easing principal `cubic-bezier(.16, 1, .3, 1)`.
- Feedback: 180–350 ms; entrada: 600 ms; ambiente: 4–30 s.
- Pointer parallax apenas com mouse; scroll limitado a -45/+70 px, atualizado via requestAnimationFrame, sem escrita fora do viewport.
- Movimento reduzido desativa animações CSS, parallax e pulso de presença.
- A pausa manual cancela listeners e frames do parallax; não persiste entre recargas.
- Sem novas dependências. Google Fonts continua sendo uma dependência de build já existente.
- Backend e contratos fora do escopo. Validar as rotas autenticadas com dados reais quando o ambiente completo estiver disponível.

## Validação reproduzível

No frontend: `npm test -- --maxWorkers=2`, `npm run lint`, `npm run typecheck`, `npm run build`.
Abrir `/` em desktop e celular; conferir CTAs, seção Universo, pausa e movimento reduzido. Conferir login/registro e superfícies autenticadas com uma sessão válida.
