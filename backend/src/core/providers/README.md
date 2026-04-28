# Providers, identities e contas conectadas

Esta fundacao separa tres conceitos:

- Provider: origem externa registrada no `provider-registry`, com status, fonte de dados e capabilities.
- Identidade externa: par unico `provider + externalId`, pertencente a no maximo um usuario CLUTCH.
- Conta conectada: vinculo persistido em `PlatformIntegration` entre `userId` e uma identidade externa.

Login social e conta conectada usam a mesma base de identidade, mas finalidades diferentes:

- `SOCIAL_LOGIN`: provider pode autenticar uma sessao CLUTCH futura.
- `CONNECTED_ACCOUNT`: provider agrega biblioteca, presenca, showcase ou dados sociais a uma conta existente.

## Como adicionar um provider

1. Adicione o provider ao enum `Platform` e crie migration.
2. Registre o provider em `provider-registry.ts` com `capabilities`, `dataSource` e `status`.
3. Implemente o client externo em `infra/integrations` sem expor secrets ou tokens ao frontend.
4. Persistir o vinculo deve passar por `connected-account.service.ts`.
5. Trate conflitos de ownership como erro de dominio, nunca como sucesso silencioso.
6. Cubra a capability matrix, conflitos e compatibilidade com testes.

Tokens externos devem ser protegidos antes de persistir. Rotas e frontends devem consumir apenas contratos de dominio, sem payload bruto do provider.

## Dados legados e diagnostico

A unicidade global de `provider + externalId` e parte da fundacao: a mesma identidade externa nao pode pertencer a dois usuarios CLUTCH.

Antes desta fundacao, a integracao Epic gravava `externalId = "epic"` para toda conexao. A migration converte esses registros para `legacy:epic:<userId>`, marca `status = NEEDS_REAUTH` e `dataSource = EXPERIMENTAL`. Esse valor e apenas um fallback legado para preservar a linha existente; ele nao representa uma identidade Epic confiavel.

Para procurar duplicidades antes da migration, rode:

```bash
psql "$DATABASE_URL" -f backend/prisma/diagnostics/platform-integration-identity-duplicates.sql
```

Qualquer linha retornada depois do backfill Epic exige correcao manual antes do indice unico global.
