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

// Dependências opcionais — se `npm install` não as tiver, o resto da app continua a funcionar
let cron = null;
let ExcelJS = null;
try { cron = require('node-cron'); }
catch (e) { console.warn('[server] node-cron indisponível — cron de backups desactivado.'); }
try { ExcelJS = require('exceljs'); }
catch (e) { console.warn('[server] exceljs indisponível — snapshots Excel desactivados.'); }

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------
// Backups automáticos — configuração
// ------------------------------------------------------------
const BACKUP_KEYS = ['ops', 'settings'];       // chaves que fazem snapshot JSON
const BACKUP_RETENTION_DAYS = 30;              // JSON: 30 dias
const BACKUP_XLSX_RETENTION_HOURS = 24;        // Excel: 24 horas
const BACKUP_CRON_EXPR = '0 8,10,12,14,16,18 * * *';  // 08/10/12/14/16/18 Lisboa
const BACKUP_TZ = 'Europe/Lisbon';

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
  'realPorDia',  // reais por dia (para OPs segmentadas)
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
    // Validação: OP e Produto obrigatórios (evita OPs fantasma)
    const _opField = (body.op || '').toString().trim();
    const _produtoField = (body.produto || '').toString().trim();
    if (!_opField || _opField.toUpperCase() === 'VAZIO') {
      return res.status(400).json({ ok: false, error: 'Campo OP obrigatório.' });
    }
    if (!_produtoField) {
      return res.status(400).json({ ok: false, error: 'Campo Produto obrigatório.' });
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

// PUT /api/settings — Planeador edita tudo; Produção edita turnos + paragens
const PRODUCAO_SETTING_KEYS = ['turnosPorDia', 'turnosPorMaquina', 'stops'];
app.put('/api/settings', async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const profile = profileOf(req);
    const body = req.body || {};
    if (typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ ok: false, error: 'Body inválido.' });
    }
    let payload = body;
    if (profile === 'producao') {
      payload = {};
      for (const k of PRODUCAO_SETTING_KEYS) {
        if (Object.prototype.hasOwnProperty.call(body, k)) payload[k] = body[k];
      }
      if (Object.keys(payload).length === 0) {
        return res.status(403).json({ ok: false, error: 'Produção só pode editar: ' + PRODUCAO_SETTING_KEYS.join(', ') });
      }
    }
    const settings = await db.putSettings(payload);
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
// Backups automáticos — gerador Excel + rotina de snapshot
// ------------------------------------------------------------

// Gera um workbook Excel a partir das OPs actuais (dump por máquina + Buffer + Settings).
// Nota: não replicamos o scheduler do cliente aqui — dump raw de payload
// (weekKey, diaIdx, sortIdx, hInicioP, hFimP planeados). O JSON é a fonte da verdade;
// o Excel é um snapshot legível para arquivo.
async function generateBackupXlsx() {
  if (!ExcelJS) throw new Error('ExcelJS não disponível — verifica se `exceljs` está em package.json.');
  const [ops, settings] = await Promise.all([db.listOps(), db.getSettings()]);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Planeamento DENSIDADES — Backup';
  wb.created = new Date();

  const opCols = [
    { header: 'Máquina',           key: 'maquina',       width: 18 },
    { header: 'Semana',            key: 'weekKey',       width: 12 },
    { header: 'Dia (idx)',         key: 'diaIdx',        width: 8  },
    { header: 'Sort',              key: 'sortIdx',       width: 6  },
    { header: 'OP',                key: 'op',            width: 16 },
    { header: 'PO / Pedido',       key: 'poPedido',      width: 18 },
    { header: 'Estado',            key: 'estado',        width: 20 },
    { header: 'File / Cliente',    key: 'fileCliente',   width: 22 },
    { header: 'Produto',           key: 'produto',       width: 36 },
    { header: 'Calibre',           key: 'calibre',       width: 10 },
    { header: 'Massas',            key: 'massas',        width: 12 },
    { header: 'Qtd Entrada',       key: 'qtdEntrada',    width: 12 },
    { header: 'Destino',           key: 'destino',       width: 16 },
    { header: 'Início P',          key: 'hInicioP',      width: 10 },
    { header: 'Fim P',             key: 'hFimP',         width: 10 },
    { header: 'Duração P',         key: 'duracaoP',      width: 10 },
    { header: 'Início R',          key: 'hInicioR',      width: 10 },
    { header: 'Fim R',             key: 'hFimR',         width: 10 },
    { header: 'Lote ADE',          key: 'loteAde',       width: 12 },
    { header: 'Qtd ADE',           key: 'qtdFinalAde',   width: 12 },
    { header: 'Colaborador',       key: 'colaborador',   width: 14 },
    { header: 'Obs PI',            key: 'obsPi',         width: 24 },
    { header: 'Observações',       key: 'obs',           width: 24 },
    { header: 'Data Plano',        key: 'dataPlano',     width: 12 },
  ];

  function makeSheet(name, argb) {
    const ws = wb.addWorksheet(name);
    ws.columns = opCols;
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    return ws;
  }

  // Distinct máquinas (excepto BUFFER) por ordem alfabética
  const maquinasSet = new Set();
  for (const o of ops) {
    if (o && o.maquina && o.maquina !== 'BUFFER') maquinasSet.add(o.maquina);
  }
  const maquinas = Array.from(maquinasSet).sort();

  const sortOps = arr => arr.slice().sort((a, b) => {
    const wk = (a.weekKey || '').localeCompare(b.weekKey || '');
    if (wk !== 0) return wk;
    const di = (a.diaIdx || 0) - (b.diaIdx || 0);
    if (di !== 0) return di;
    return (a.sortIdx || 0) - (b.sortIdx || 0);
  });

  // Uma folha por máquina
  for (const m of maquinas) {
    const ws = makeSheet(m.substring(0, 31), 'FFDCE6F1');
    sortOps(ops.filter(o => o && o.maquina === m)).forEach(o => ws.addRow(o));
  }

  // Folha Buffer
  const bufferOps = ops.filter(o => o && o.maquina === 'BUFFER');
  if (bufferOps.length > 0) {
    const ws = makeSheet('Buffer', 'FFFFE699');
    sortOps(bufferOps).forEach(o => ws.addRow(o));
  }

  // Folha "Todas" — dump total sem filtro (util para diff)
  {
    const ws = makeSheet('Todas', 'FFDCE6CE');
    sortOps(ops).forEach(o => ws.addRow(o));
  }

  // Folha Settings — key/value achatado
  {
    const ws = wb.addWorksheet('Settings');
    ws.columns = [
      { header: 'Chave', key: 'k', width: 32 },
      { header: 'Valor (JSON)', key: 'v', width: 120 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    for (const [k, v] of Object.entries(settings || {})) {
      ws.addRow({ k, v: JSON.stringify(v) });
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

async function runBackupSnapshot(triggeredBy = 'auto', note = null) {
  if (!db.isConnected()) throw new Error('BD indisponível.');
  const results = [];

  // 1) Snapshot JSON — OPs
  try {
    const ops = await db.listOps();
    const row = await db.insertBackupJson('ops', ops, triggeredBy, note);
    results.push({ key: 'ops', ok: true, id: row.id, count: ops.length });
  } catch (e) {
    console.error('[backup] falha snapshot ops:', e.message);
    results.push({ key: 'ops', ok: false, reason: e.message });
  }

  // 2) Snapshot JSON — Settings
  try {
    const settings = await db.getSettings();
    const row = await db.insertBackupJson('settings', settings, triggeredBy, note);
    results.push({ key: 'settings', ok: true, id: row.id, count: Object.keys(settings || {}).length });
  } catch (e) {
    console.error('[backup] falha snapshot settings:', e.message);
    results.push({ key: 'settings', ok: false, reason: e.message });
  }

  // 3) Retenção JSON — 30 dias
  try {
    const n = await db.pruneBackupsJson(BACKUP_RETENTION_DAYS);
    if (n > 0) console.log(`[backup] retenção JSON: apagados ${n} > ${BACKUP_RETENTION_DAYS} dias`);
  } catch (e) { console.warn('[backup] retenção JSON falhou:', e.message); }

  // 4) Excel + retenção 24h (skipado se ExcelJS indisponível)
  if (ExcelJS) {
    try {
      const buf = await generateBackupXlsx();
      const row = await db.insertBackupXlsx(buf, triggeredBy);
      const n = await db.pruneBackupsXlsxByHours(BACKUP_XLSX_RETENTION_HOURS);
      if (n > 0) console.log(`[backup] retenção Excel: apagados ${n} > ${BACKUP_XLSX_RETENTION_HOURS}h`);
      results.push({ key: 'xlsx', ok: true, id: row.id, size: buf.length });
    } catch (e) {
      console.error('[backup] falha Excel:', e.message);
      results.push({ key: 'xlsx', ok: false, reason: e.message });
    }
  } else {
    results.push({ key: 'xlsx', ok: false, reason: 'ExcelJS indisponível' });
  }

  console.log(`[backup] snapshot ${triggeredBy} @ ${new Date().toISOString()}:`, results);
  return results;
}

function scheduleBackupCron() {
  if (!cron) {
    console.warn('[cron/backup] node-cron indisponível — agendamento saltado.');
    return;
  }
  try {
    cron.schedule(BACKUP_CRON_EXPR, () => {
      runBackupSnapshot('auto').catch(e => console.error('[cron/backup]', e));
    }, { timezone: BACKUP_TZ });
    console.log(`[cron/backup] agendado "${BACKUP_CRON_EXPR}" TZ=${BACKUP_TZ}`);
  } catch (e) {
    console.error('[cron/backup] falhou ao agendar:', e.message);
  }
}

// ------------------------------------------------------------
// Endpoints — Backups
// ⚠ ORDEM CRÍTICA: rotas específicas ANTES de /:id
// ------------------------------------------------------------

// GET /api/backups/xlsx — lista Excel snapshots
app.get('/api/backups/xlsx', async (_req, res) => {
  if (!requireDb(res)) return;
  try {
    const rows = await db.listBackupsXlsx(20);
    res.json({ ok: true, backups: rows });
  } catch (e) { sendError(res, e, 'GET /api/backups/xlsx falhou'); }
});

// GET /api/backups/xlsx/:id — download do Excel
app.get('/api/backups/xlsx/:id(\\d+)', async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const row = await db.getBackupXlsx(parseInt(req.params.id, 10));
    if (!row) return res.status(404).json({ ok: false, error: 'Backup Excel não encontrado.' });
    const stamp = new Date(row.snapshot_at).toISOString().replace(/[-:]/g, '').slice(0, 13);
    const fname = `Planeamento_DENSIDADES_backup_${stamp}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.send(row.xlsx_data);
  } catch (e) { sendError(res, e, 'GET /api/backups/xlsx/:id falhou'); }
});

// POST /api/backups/trigger — trigger manual (só Planeador)
app.post('/api/backups/trigger', async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const profile = profileOf(req);
    if (profile !== 'planeador') {
      return res.status(403).json({ ok: false, error: 'Apenas o perfil planeador pode disparar backups.' });
    }
    const note = (req.body && req.body.note) || null;
    const results = await runBackupSnapshot('manual', note);
    res.json({ ok: true, results });
  } catch (e) { sendError(res, e, 'POST /api/backups/trigger falhou'); }
});

// GET /api/backups?key=&limit= — lista JSON snapshots
app.get('/api/backups', async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const rows = await db.listBackupsJson(req.query.key || null, req.query.limit || 100);
    res.json({ ok: true, backups: rows });
  } catch (e) { sendError(res, e, 'GET /api/backups falhou'); }
});

// GET /api/backups/:id — download JSON
app.get('/api/backups/:id(\\d+)', async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const row = await db.getBackupJson(parseInt(req.params.id, 10));
    if (!row) return res.status(404).json({ ok: false, error: 'Backup não encontrado.' });
    res.json({ ok: true, ...row });
  } catch (e) { sendError(res, e, 'GET /api/backups/:id falhou'); }
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
      await db.migrateToUnidades();
      await db.migrateCalibre6Digits();
      await db.migrateSwapLinhas();
      await db.seedIfEmpty();
    } else {
      console.warn('[server] A arrancar em modo demo (sem persistência). Todas as escritas devolverão 503.');
    }
  } catch (e) {
    console.error('[server] Falha ao inicializar BD:', e.message);
    console.warn('[server] A continuar mesmo assim — escritas falharão até a BD ficar disponível.');
  }
  if (db.isConnected()) {
    scheduleBackupCron();
  } else {
    console.warn('[cron/backup] BD indisponível — cron desactivado.');
  }
  app.listen(PORT, () => {
    console.log(`[planeamento-densidades] A servir na porta ${PORT}`);
  });
})();
