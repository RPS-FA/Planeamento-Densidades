// ============================================================
// Planeamento DENSIDADES — Servidor Express + API REST + Postgres
// ============================================================
// Serve o protótipo HTML (public/) e expõe uma API JSON que o
// cliente usa para persistir OPs e settings na base de dados.
//
// Endpoints:
//   GET    /api/state          — {ops, settings, ts}
//   GET    /api/ops            — {ops:[...]}
//   POST   /api/ops            — cria nova OP (perfil planeador)
//   PUT    /api/ops/:id        — actualiza OP (perfil planeador OU produção c/ whitelist)
//   DELETE /api/ops/:id        — apaga (perfil planeador)
//   GET    /api/settings       — {settings:{...}}
//   PUT    /api/settings       — substitui chaves de settings
//   POST   /api/admin/reset    — apaga tudo e re-seeds
//   GET    /health             — healthcheck Railway
//
// Header X-Profile: 'planeador' (default) | 'producao'
// ============================================================

const express = require('express');
const compression = require('compression');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------
// Middleware
// ------------------------------------------------------------
app.use(compression());
app.use(express.json({ limit: '2mb' }));

// Cache headers — HTML sempre fresh, assets cache 1h
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
  next();
});

// ------------------------------------------------------------
// Whitelist: campos editáveis pelo perfil "producao"
// ------------------------------------------------------------
const PRODUCAO_FIELDS = [
  'estado',
  'loteAde',
  'qtdFinalAde',
  'hInicioR',
  'hFimR',
  'tempoAtraso',
  'colaborador',
  'obs',
];

function profileOf(req) {
  const h = (req.get('X-Profile') || '').toLowerCase();
  return h === 'producao' ? 'producao' : 'planeador';
}

function requireDb(res) {
  if (!db.isConnected()) {
    res.status(503).json({ ok: false, error: 'BD indisponível (DATABASE_URL não configurada).' });
    return false;
  }
  return true;
}

function sendError(res, e, fallback) {
  const msg = (e && e.message) || fallback || 'erro desconhecido';
  console.error('[api]', msg, e && e.stack ? '\n' + e.stack : '');
  res.status(500).json({ ok: false, error: msg });
}

// ------------------------------------------------------------
// Routes — API
// ------------------------------------------------------------

// GET /api/state — conveniência: tudo num só pedido (boot do cliente)
app.get('/api/state', async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const [ops, settings] = await Promise.all([db.listOps(), db.getSettings()]);
    res.json({ ops, settings, ts: new Date().toISOString() });
  } catch (e) { sendError(res, e, 'GET /api/state falhou'); }
});

// GET /api/ops
app.get('/api/ops', async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const ops = await db.listOps();
    res.json({ ops });
  } catch (e) { sendError(res, e, 'GET /api/ops falhou'); }
});

// POST /api/ops — só Planeador
app.post('/api/ops', async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const profile = profileOf(req);
    if (profile !== 'planeador') {
      return res.status(403).json({ ok: false, error: 'Apenas o perfil planeador pode criar OPs.' });
    }
    const body = req.body || {};
    if (typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ ok: false, error: 'Body inválido.' });
    }
    const op = await db.createOp(body, profile);
    res.json({ ok: true, op });
  } catch (e) { sendError(res, e, 'POST /api/ops falhou'); }
});

// PUT /api/ops/:id — Planeador (todos os campos) ou Produção (whitelist)
app.put('/api/ops/:id', async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ ok: false, error: 'ID inválido.' });
    const profile = profileOf(req);
    const body = req.body || {};
    if (typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ ok: false, error: 'Body inválido.' });
    }

    let merged;
    if (profile === 'producao') {
      const current = await db.getOp(id);
      if (!current) return res.status(404).json({ ok: false, error: 'OP não encontrada.' });
      merged = Object.assign({}, current);
      for (const f of PRODUCAO_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(body, f)) {
          merged[f] = body[f];
        }
      }
    } else {
      // Planeador — aceita tudo, mas preserva o id da rota
      merged = Object.assign({}, body);
      merged.id = id;
    }

    const updated = await db.updateOp(id, merged, profile);
    if (!updated) return res.status(404).json({ ok: false, error: 'OP não encontrada.' });
    res.json({ ok: true, op: updated });
  } catch (e) { sendError(res, e, 'PUT /api/ops/:id falhou'); }
});

// DELETE /api/ops/:id — só Planeador
app.delete('/api/ops/:id', async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const profile = profileOf(req);
    if (profile !== 'planeador') {
      return res.status(403).json({ ok: false, error: 'Apenas o perfil planeador pode apagar OPs.' });
    }
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ ok: false, error: 'ID inválido.' });
    const ok = await db.deleteOp(id);
    if (!ok) return res.status(404).json({ ok: false, error: 'OP não encontrada.' });
    res.json({ ok: true, deleted: id });
  } catch (e) { sendError(res, e, 'DELETE /api/ops/:id falhou'); }
});

// GET /api/settings
app.get('/api/settings', async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const settings = await db.getSettings();
    res.json({ settings });
  } catch (e) { sendError(res, e, 'GET /api/settings falhou'); }
});

// PUT /api/settings — só Planeador
app.put('/api/settings', async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const profile = profileOf(req);
    if (profile !== 'planeador') {
      return res.status(403).json({ ok: false, error: 'Apenas o perfil planeador pode editar settings.' });
    }
    const body = req.body || {};
    if (typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ ok: false, error: 'Body inválido.' });
    }
    const settings = await db.putSettings(body);
    res.json({ ok: true, settings });
  } catch (e) { sendError(res, e, 'PUT /api/settings falhou'); }
});

// POST /api/admin/wipe — apaga TODAS as OPs (sem re-seed) — só Planeador
app.post('/api/admin/wipe', async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const profile = profileOf(req);
    if (profile !== 'planeador') {
      return res.status(403).json({ ok: false, error: 'Apenas o perfil planeador pode limpar.' });
    }
    const deleted = await db.deleteAllOps(profile);
    res.json({ ok: true, deleted });
  } catch (e) { sendError(res, e, 'POST /api/admin/wipe falhou'); }
});

// POST /api/admin/reset — apaga tudo e re-seeds (só Planeador)
app.post('/api/admin/reset', async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const profile = profileOf(req);
    if (profile !== 'planeador') {
      return res.status(403).json({ ok: false, error: 'Apenas o perfil planeador pode resetar.' });
    }
    const ops = await db.resetOps(profile);
    res.json({ ok: true, ops });
  } catch (e) { sendError(res, e, 'POST /api/admin/reset falhou'); }
});

// ------------------------------------------------------------
// Healthcheck
// ------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'planeamento-densidades',
    db: db.isConnected() ? 'connected' : 'demo-mode',
    ts: new Date().toISOString(),
  });
});

// ------------------------------------------------------------
// Estáticos + fallback
// ------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public'), {
  index: 'index.html',
  extensions: ['html'],
}));

// Fallback — qualquer rota não-API → index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ------------------------------------------------------------
// Arranque
// ------------------------------------------------------------
(async () => {
  try {
    if (db.isConnected()) {
      await db.initSchema();
      await db.migrateLegacyEstados();
      await db.migrateClearImportedHours();
      await db.seedIfEmpty();
    } else {
      console.warn('[server] A arrancar em modo demo (sem persistência). Todas as escritas devolverão 503.');
    }
  } catch (e) {
    console.error('[server] Falha ao inicializar BD:', e.message);
    console.warn('[server] A continuar mesmo assim — escritas falharão até a BD ficar disponível.');
  }
  app.listen(PORT, () => {
    console.log(`[planeamento-densidades] A servir na porta ${PORT}`);
  });
})();
