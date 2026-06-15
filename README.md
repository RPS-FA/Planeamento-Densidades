# Planeamento DENSIDADES — Web App (Cliente-Servidor)

App de planeamento de produção das Densidades. Arquitectura: Node.js + Express + Postgres no Railway, frontend HTML estático com chamadas fetch à API.

## Estrutura

```
Railway/
├── server.js           # Express + API REST
├── db.js               # Camada de persistência (driver `pg`)
├── schema.sql          # DDL Postgres (auto-aplicado no arranque)
├── package.json        # Node 18+ / express + compression + pg
├── railway.toml        # Configuração Railway (build + healthcheck)
├── nixpacks.toml       # Forca Node 20 no builder Nixpacks
├── .gitignore
├── public/
│   └── index.html      # Cliente — todo o UI (chama /api/...)
├── DEPLOY_GITHUB.md    # Passo-a-passo do deploy
├── test-local.md       # Como testar localmente com Postgres
└── README.md
```

## Arquitectura

- **Backend** Express com API REST JSON em `/api/...`
- **Base de dados** Postgres (Railway gere o serviço; injecta `DATABASE_URL` automaticamente)
- **Frontend** `public/index.html` (single-page). Faz `fetch` para a API; sem build-step
- **Multi-utilizador** várias pessoas podem editar em paralelo; cliente faz polling cada 30s para refrescar o estado
- **Perfis**: `planeador` (edita tudo) e `producao` (whitelist no servidor — só campos pós-execução)

## Adicionar Postgres no Railway

1. No dashboard do projeto: **New → Database → Add PostgreSQL**
2. Railway cria a base de dados e injecta automaticamente `DATABASE_URL` no serviço web (variável de ambiente partilhada)
3. No primeiro arranque, o `server.js` chama `db.initSchema()` (cria tabelas) e `db.seedIfEmpty()` (insere as 19 OPs iniciais se a tabela `ops` estiver vazia). Tudo idempotente
4. Não é preciso correr migrations manualmente

Se `DATABASE_URL` não estiver definida, o servidor arranca em **modo demo** — serve o frontend mas devolve `503` a qualquer operação que mexa na BD.

## API REST

| Método | Path | Perfil | Função |
|---|---|---|---|
| GET | `/api/state` | qualquer | Devolve `{ops, settings, ts}` (boot do cliente) |
| GET | `/api/ops` | qualquer | Devolve `{ops: [...]}` |
| POST | `/api/ops` | planeador | Cria OP (ignora `id` do body; gera novo) |
| PUT | `/api/ops/:id` | planeador / produção | Actualiza. Em produção, só campos da whitelist |
| DELETE | `/api/ops/:id` | planeador | Apaga |
| GET | `/api/settings` | qualquer | Devolve `{settings: {...}}` |
| PUT | `/api/settings` | planeador | Substitui chaves enviadas |
| POST | `/api/admin/reset` | planeador | Apaga e re-seeds (para botão "Reset demo") |
| GET | `/health` | — | Healthcheck Railway (inclui estado da BD) |

**Header**: `X-Profile: planeador` (default) | `producao`

**Whitelist Produção** (campos editáveis): `estado`, `loteAde`, `qtdFinalAde`, `hInicioR`, `hFimR`, `tempoAtraso`, `colaborador`, `obs`

## Deploy (3 vias)

Ver `DEPLOY_GITHUB.md` para o caminho recomendado (GitHub + Railway dashboard).

### Opção 1 — CLI Railway

```powershell
npm i -g @railway/cli
railway login
cd "C:\Users\rpsilva\OneDrive - Harv 81\Documents\Claude\Projects\Planeamento DENSIDADES\Railway"
railway init
railway add --plugin postgresql   # adiciona Postgres (injecta DATABASE_URL)
railway up
railway domain                    # gera URL público
```

### Opção 2 — GitHub + Railway dashboard

Ver `DEPLOY_GITHUB.md`.

### Opção 3 — Drag-and-drop ZIP

Zipar a pasta `Railway/` (sem `node_modules`) → Railway → New Project → Empty Service → Settings → Source → Upload.

## Testar localmente

Ver `test-local.md` (Docker ou Postgres.app).

Sem BD:

```powershell
cd Railway
npm install
npm start
# → http://localhost:3000  (modo demo, escritas devolvem 503)
```

## Variáveis de ambiente

| Nome | Obrigatório? | Quem injecta |
|---|---|---|
| `DATABASE_URL` | Sim, em produção | Railway (ao adicionar Postgres) |
| `PORT` | Não | Railway |

## Healthcheck

`GET /health` → `{"status":"ok","service":"planeamento-densidades","db":"connected","ts":"..."}`

## Custos estimados

Railway hobby plan: $5/mês de crédito incluído. Web service Express + Postgres pequeno consome ~$2-4/mês com tráfego moderado.

---

**Cork Supply / Harv 81 Group** · Planeamento Produção
