# CLUTCH ⚡ — Notas de Segurança

## Vulnerabilidades conhecidas e monitoradas

---

### [MODERATE] undici < 6.23.0 via discord.js@14.x

**CVE:** GHSA-g9mf-h72j-4rw9
**Severidade:** Moderate
**Reportado em:** 2025
**Status:** ⚠️ Monitorando — sem fix limpo disponível

#### Descrição
O `discord.js@14.x` depende de `undici` para suas requisições HTTP internas.
Versões do `undici < 6.23.0` possuem uma vulnerabilidade de decompressão
não limitada via `Content-Encoding`, que pode causar resource exhaustion.

#### Por que não aplicamos o fix automático
O `npm audit fix --force` downgradearia `discord.js` para `v13.x`, que:
- Remove `GatewayIntentBits` e `ActivityType` (usados no Rich Presence)
- É uma versão em fim de vida (EOL)
- Quebraria toda a integração do Discord Bot

#### Mitigação aplicada
- O Discord Bot só se comunica com endpoints oficiais de `discord.com`
- Não aceita conexões ou requisições externas
- Está isolado do fluxo principal da API
- O ambiente de produção estará atrás de rede controlada

#### Ação futura
Monitorar releases do `discord.js@14.x` — o maintainer está ciente do
problema e a correção virá em uma atualização patch sem breaking changes.

**Referência:** https://github.com/advisories/GHSA-g9mf-h72j-4rw9
**Issue de tracking:** Verificar na Issue #36 (Integração Discord)

---

## Status geral do audit

| Pacote | Versão | Status |
|---|---|---|
| `fastify` | `^5.8.2` | ✅ Atualizado |
| `vitest` | `^3.1.0` | ✅ Atualizado |
| `esbuild` | via vitest v3 | ✅ Resolvido |
| `discord.js/undici` | `^14.16.2` | ⚠️ Monitorando |