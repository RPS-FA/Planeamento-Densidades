# Teste Local — Planeamento DENSIDADES

Como correr o app localmente, com ou sem Postgres.

## Sem Postgres (modo demo)

Útil para testar o frontend e endpoints REST com respostas 503.

```powershell
cd Railway
npm install
npm start
# → http://localhost:3000
# → /health diz "db": "demo-mode"
```

Todas as escritas (POST/PUT/DELETE) devolvem **503**. O frontend mostra "🔴 Sem ligação" no chip do header.

## Com Postgres — Docker (recomendado)

Mais simples. Requer Docker Desktop instalado.

```powershell
# 1. Arrancar Postgres num container
docker run -d --name pg-planeamento `
  -e POSTGRES_PASSWORD=dev `
  -e POSTGRES_USER=dev `
  -e POSTGRES_DB=planeamento `
  -p 5432:5432 `
  postgres:16

# 2. Configurar variável de ambiente e arrancar
cd Railway
$env:DATABASE_URL = "postgres://dev:dev@localhost:5432/planeamento?sslmode=disable"
npm install
npm start
```

⚠️ Para correr local sem SSL, o driver `pg` aceita `?sslmode=disable` no URL. O `db.js` usa `ssl: { rejectUnauthorized: false }` por defeito — em local, o Postgres não tem SSL configurado, mas o driver acaba por funcionar se a URL tiver `sslmode=disable` (override).

Para parar/limpar:

```powershell
docker stop pg-planeamento
docker rm pg-planeamento
```

## Com Postgres — Postgres.app (Mac) ou instalação nativa (Windows)

1. Instalar Postgres 16 nativamente
2. Criar database: `createdb planeamento`
3. `$env:DATABASE_URL = "postgres://USER:PASS@localhost:5432/planeamento?sslmode=disable"`
4. `npm start`

## Verificações rápidas

```powershell
# Healthcheck
curl http://localhost:3000/health

# Listar OPs (devem aparecer 19 da seed)
curl http://localhost:3000/api/ops | ConvertFrom-Json | Select -ExpandProperty ops | Measure-Object

# Criar nova OP de teste
$body = '{"op":"TEST001","tipo":"DENS","maquina":"Linha 10","weekKey":"2026-W25","estado":"PI por liberar"}'
curl -Method POST -ContentType application/json `
  -Headers @{ "X-Profile" = "planeador" } `
  -Body $body http://localhost:3000/api/ops

# Tentar criar com perfil produção → deve dar 403
curl -Method POST -ContentType application/json `
  -Headers @{ "X-Profile" = "producao" } `
  -Body $body http://localhost:3000/api/ops
```

## Limpar BD durante desenvolvimento

```powershell
# Via API admin
curl -Method POST -Headers @{ "X-Profile" = "planeador" } http://localhost:3000/api/admin/reset

# Via psql
psql $env:DATABASE_URL -c "TRUNCATE ops RESTART IDENTITY; TRUNCATE settings;"
# (a seguir, reiniciar o servidor para fazer seed)
```

## Browser DevTools

- **Network** → filtrar por `/api/` para ver as chamadas em tempo real
- **Console** — qualquer erro de fetch aparece com `[loadStateFromServer]` ou similar
- **Chip do header**: 🟢 ligado · 🟡 a carregar · 🔴 sem ligação

## Troubleshooting

| Sintoma | Causa provável |
|---|---|
| Chip sempre 🔴 | Servidor em modo demo (sem `DATABASE_URL`) ou BD não acessível. Ver `/health` |
| Erro `SSL required` no log | `ssl: { rejectUnauthorized: false }` está OK, mas o Postgres local não tem SSL. Acrescentar `?sslmode=disable` ao URL |
| OPs duplicadas após reset | Re-seeds em loop. Verificar se `seedIfEmpty` está a ser chamado mais que uma vez |
| 403 ao guardar | Header `X-Profile` em falta ou a tentar editar campo fora da whitelist com perfil produção |

---

**Cork Supply / Harv 81 Group**
