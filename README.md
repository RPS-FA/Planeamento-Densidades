# Planeamento DENSIDADES — Deploy Railway

Servidor estático mínimo para alojar o protótipo `Planeamento_Densidades.html` no Railway.

## Estrutura

```
Railway/
├── server.js              # Express servindo /public estaticamente
├── package.json           # Node 18+ / express + compression
├── railway.toml           # Configuração Railway (build + healthcheck)
├── nixpacks.toml          # Forca Node 20 no builder Nixpacks
├── .gitignore
├── public/
│   └── index.html         # O protótipo (cópia de Planeamento_Densidades.html)
└── README.md
```

## Persistência de dados

O protótipo guarda tudo em **`localStorage` do browser** + opcional **BackupSync** (File System Access API → pasta OneDrive/SharePoint do utilizador). **Não há backend de dados** — cada utilizador tem o seu estado local.

Para persistência partilhada multi-utilizador (estilo PlannerCork), seria preciso acrescentar:
- API backend (Express endpoints `/api/data`, `/api/settings`)
- Base de dados (Postgres no Railway é grátis até X GB)
- Adapter `Storage` do HTML para apontar para a API em vez de `localStorage`

## Deploy (3 vias)

### Opção 1 — CLI Railway (mais rápida)

```powershell
# Instalar CLI uma só vez
npm i -g @railway/cli
railway login

# Na pasta Railway/
cd "C:\Users\rpsilva\OneDrive - Harv 81\Documents\Claude\Projects\Planeamento DENSIDADES\Railway"
railway init   # criar projeto novo OU "railway link" para projeto existente
railway up     # build + deploy
railway domain # gerar URL público
```

### Opção 2 — GitHub + Railway dashboard

1. Push da pasta `Railway/` para um repositório GitHub (privado)
2. No dashboard Railway → **New Project → Deploy from GitHub repo**
3. Selecionar o repositório → Railway detecta `package.json` e `nixpacks.toml`
4. Aguarda build (~1-2 min) → URL gerado automaticamente

### Opção 3 — Drag-and-drop ZIP

1. Zipar a pasta `Railway/` (excluindo `node_modules`)
2. No Railway → **New Project → Empty Service → Settings → Source → Upload**

## Atualizar protótipo

Quando o `Planeamento_Densidades.html` for atualizado:

```powershell
copy "..\Planeamento_Densidades.html" "public\index.html"
railway up
```

Se usar GitHub: commit + push, Railway faz auto-deploy.

## Teste local antes de deploy

```powershell
cd Railway
npm install
npm start
# → abrir http://localhost:3000
```

## Variáveis de ambiente

Nenhuma obrigatória. `PORT` é injetado automaticamente pelo Railway.

## Healthcheck

Endpoint `/health` devolve JSON com timestamp. Railway usa para garantir que o serviço está vivo.

## Custos estimados

Railway hobby plan: $5/mês de crédito incluído. Um servidor estático Express consome ~$0,30-0,50/mês (sleep automático em períodos de inatividade).

---

**Cork Supply / Harv 81 Group** · Planeamento Produção
