# Deploy via GitHub + Railway — Guia Passo-a-Passo

Tempo total: ~15 minutos (primeira vez). Depois, cada atualização demora 30 segundos.

---

## Pré-requisitos (instalar uma só vez)

1. **Git para Windows**: https://git-scm.com/download/win → Next, Next, Install
2. **Conta GitHub**: https://github.com/signup (grátis)
3. **Conta Railway**: https://railway.app (grátis até $5 de crédito/mês)

---

## Passo 1 — Setup Git local (automático)

Abrir **PowerShell** na pasta Railway:

```powershell
cd "C:\Users\rpsilva\OneDrive - Harv 81\Documents\Claude\Projects\Planeamento DENSIDADES\Railway"
.\deploy-setup.ps1
```

> Se aparecer erro de "execution policy", correr primeiro:
> `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

O script:
- Apaga `node_modules` e `package-lock.json` (não devem ir para o repo)
- Faz `git init`, configura user, faz primeiro commit
- Mostra os próximos passos

---

## Passo 2 — Criar repositório no GitHub

1. Abrir **https://github.com/new**
2. Preencher:
   - **Repository name**: `planeamento-densidades`
   - **Visibility**: **Private** (recomendado — só seu)
   - ❌ **NÃO marcar** "Add a README", "Add .gitignore", nem "Choose a license" (já existem localmente)
3. **Create repository**

GitHub mostra uma página com o URL do repositório. Vai aparecer algo como:
```
https://github.com/rpsilva/planeamento-densidades.git
```

---

## Passo 3 — Ligar local ao GitHub

No PowerShell (ainda dentro da pasta Railway):

```powershell
git remote add origin https://github.com/<TEU_UTILIZADOR>/planeamento-densidades.git
git push -u origin main
```

> Substitua `<TEU_UTILIZADOR>` pelo seu username GitHub.
> O Git vai pedir credenciais — use o GitHub login via browser (mais simples) ou Personal Access Token.

Depois deste push, o repositório GitHub fica com todos os ficheiros.

---

## Passo 4 — Deploy no Railway

1. Abrir **https://railway.app/new**
2. **Deploy from GitHub repo**
3. Autorizar Railway a aceder ao GitHub (primeira vez):
   - **Configure GitHub App** → **All repositories** ou só `planeamento-densidades`
   - **Install & Authorize**
4. Selecionar **planeamento-densidades** da lista
5. Railway deteta automaticamente:
   - `package.json` → Node.js
   - `nixpacks.toml` → Node 20
   - `railway.toml` → healthcheck + start command
6. Aguardar o build (~1-2 minutos) — vê o progresso em tempo real

---

## Passo 5 — Gerar URL público

1. No painel Railway, clicar no serviço criado
2. **Settings** (separador) → **Networking** → **Generate Domain**
3. Aparece um URL tipo `planeamento-densidades-production.up.railway.app`

Copie esse URL e abra no browser — vê o planeamento online.

---

## Atualizar o protótipo (workflow normal)

Quando o `Planeamento_Densidades.html` da pasta principal for atualizado:

```powershell
cd "C:\Users\rpsilva\OneDrive - Harv 81\Documents\Claude\Projects\Planeamento DENSIDADES\Railway"
copy ..\Planeamento_Densidades.html public\index.html
git add .
git commit -m "Atualização do protótipo"
git push
```

Railway deteta o push e re-deploya automaticamente em ~1 minuto.

---

## Problemas comuns

| Erro | Solução |
|---|---|
| `git not recognized` | Instalar Git para Windows (link acima) e reabrir o PowerShell |
| `Permission denied` ao push | Garantir login Git: `git config --global credential.helper manager` |
| `Build failed` no Railway | Verificar Logs no Railway → procurar a mensagem; normalmente é versão Node ou dependência |
| URL devolve 502 | Aguardar 30 seg após deploy (cold start) ou ver Logs |
| Conteúdo desatualizado | F5 forçado: `Ctrl+Shift+R` (ignora cache) |

---

## Mudar de público para privado (URL com autenticação)

Por defeito, qualquer pessoa com o URL Railway acede ao planeamento. Para restringir:

1. **Railway → Settings → Networking** → adicionar **Basic Auth** (username/password)
2. Ou: integrar Cloudflare Access em frente
3. Ou: implementar login Microsoft 365 no `server.js` (requer mais trabalho)

---

**Cork Supply / Harv 81 Group**
