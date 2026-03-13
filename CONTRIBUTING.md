# Contribuindo com o CLUTCH ⚡

---

## 🌿 Fluxo de branches

```
main          ← produção, protegida
  └── develop ← branch principal de desenvolvimento
        └── feature/nome-da-feature
        └── fix/nome-do-bug
        └── chore/nome-da-tarefa
        └── ci/nome-da-pipeline
        └── docs/nome-do-doc
        └── test/nome-do-teste
```

**Regras:**
- Nunca commitar direto em `main` ou `develop`
- Todo trabalho entra via Pull Request
- PR sempre aponta para `develop`
- `main` só recebe merge de `develop` via release

---

## 📝 Padrão de commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org):

```
<tipo>(escopo): <descrição curta>

<corpo opcional — explica o porquê, não o como>
```

**Tipos permitidos:**

| Tipo | Quando usar |
|---|---|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `chore` | Infra, deps, config |
| `refactor` | Refatoração sem mudança de comportamento |
| `test` | Adição ou correção de testes |
| `docs` | Documentação |
| `ci` | Mudanças no pipeline CI/CD |

**Exemplos:**
```bash
feat(auth): add user registration endpoint
fix(presence): handle websocket disconnection correctly
chore(backend): upgrade fastify to v5.8.2
test(auth): add unit tests for userRepository
docs: update README with local setup instructions
```

---

## 🔀 Como abrir um PR

```bash
# 1. Atualizar develop
git checkout develop
git pull origin develop

# 2. Criar branch
git checkout -b feature/nome-da-feature

# 3. Fazer commits
git commit -m "feat(escopo): descrição"

# 4. Push
git push origin feature/nome-da-feature
```

No GitHub:
- Base: `develop`
- Preencher o template de PR completamente
- Adicionar labels, assignee e projeto
- Linkar a issue com `Closes #N`

---

## ✅ Checklist antes de abrir o PR

- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx eslint src --ext .ts` — zero erros
- [ ] `npm test` — todos os testes passando
- [ ] Nenhum `any` explícito no código
- [ ] Branch atualizada com `develop`