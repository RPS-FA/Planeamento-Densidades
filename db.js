// ============================================================
// Planeamento DENSIDADES — Camada de persistência (Postgres)
// ============================================================
// Usa o driver `pg` (não pg-promise). Lê DATABASE_URL do ambiente
// (Railway injecta-a automaticamente quando se adiciona um serviço
// Postgres). SSL obrigatório com rejectUnauthorized:false.
//
// Funções expostas:
//   isConnected()          — true se o pool está disponível
//   initSchema()           — executa schema.sql (idempotente)
//   seedIfEmpty()          — insere as 19 OPs iniciais se a BD estiver vazia
//   listOps()              — devolve todas as OPs (payload expandido + id)
//   getOp(id)              — devolve uma OP única
//   createOp(payload, by)  — cria nova OP, gera novo id
//   updateOp(id, payload, by) — substitui OP
//   deleteOp(id)
//   getSettings()          — devolve {key: value, ...}
//   putSettings(obj)       — substitui todas as chaves enviadas
// ============================================================

const fs = require('fs');
const path = require('path');

let Pool = null;
try { Pool = require('pg').Pool; }
catch (e) { console.warn('[db] driver `pg` não está instalado — modo demo activado.'); }

const DATABASE_URL = process.env.DATABASE_URL || '';
let pool = null;

if (Pool && DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
  });
  pool.on('error', (err) => {
    console.error('[db] erro inesperado no pool Postgres:', err.message);
  });
  console.log('[db] Pool Postgres inicializado.');
} else {
  console.warn('[db] DATABASE_URL ausente — modo demo (sem persistência).');
}

// ============================================================
// Dados iniciais — 19 OPs reais de Jun 2026 (W23 + W24)
// Extraído directamente do DENS_DEFAULT_DATA do public/index.html
// ============================================================
const SEED_OPS = [
  { op: '13404239', tipo: 'DENS', fileCliente: '10486', produto: 'N-QV2-NAT-45X240-0101-ADE-SDS-TA', calibre: '45x24', massas: '2,9-4,1', qtdEntrada: 66.3, obsPi: '', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Linha 10', estado: 'PI por liberar', hInicioP: '07:00', hFimP: '13:23', duracaoP: '05:23', hInicioR: '', hFimR: '13:20', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 0, diaIdx: 0 },
  { op: '13404262', tipo: 'DENS', fileCliente: '13913 ENC', produto: 'N-QV2-NAT-45X242-1111-ADE-SDS-TA', calibre: '45x24', massas: '2,9 - 3,9', qtdEntrada: 40.0, obsPi: 'ENCOMENDA - Continua a 02/06', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Linha 10', estado: 'PI por liberar', hInicioP: '13:28', hFimP: '16:45', duracaoP: '03:17', hInicioR: '13:25', hFimR: '16:45', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 1, diaIdx: 0 },
  { op: '13404260', tipo: 'DENS', fileCliente: '13385 ENC', produto: 'N-QV2-NAT-49X240-0101-ADE-SDS-TA', calibre: '49x24', massas: '3,2-4,3', qtdEntrada: 15.0, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Linha 9', estado: 'PI por liberar', hInicioP: '07:00', hFimP: '10:25', duracaoP: '03:25', hInicioR: '09:15', hFimR: '12:30', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 0, diaIdx: 0 },
  { op: '13404263', tipo: 'DENS', fileCliente: '11704', produto: 'N-QV2-NAT-49X242-0101-ADE-SDS-TA', calibre: '49x24', massas: '3,2-4,6', qtdEntrada: 20.0, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Linha 9', estado: 'PI por liberar', hInicioP: '10:30', hFimP: '16:01', duracaoP: '04:31', hInicioR: '14:20', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 1, diaIdx: 0 },
  { op: '13404259', tipo: 'DENS', fileCliente: '10882 ENC', produto: 'N-QV2-NAT-49X242-0101-ADE-SDS-TA', calibre: '49x24', massas: '3,2-4,3', qtdEntrada: 30.8, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Linha 10', estado: 'PI por liberar', hInicioP: '07:00', hFimP: '09:32', duracaoP: '02:32', hInicioR: '08:20', hFimR: '11:30', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 2, diaIdx: 1 },
  { op: '13404264', tipo: 'DENS', fileCliente: 'CSP2 AI', produto: 'N-QV2-323-49X240-1010-ADE-CRU', calibre: '49x24', massas: '3,1 - 4,6', qtdEntrada: 12.8, obsPi: 'CSP2 AI', destino: 'CSP2 AI', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Linha 10', estado: 'CSP2-AI por liberar', hInicioP: '09:37', hFimP: '10:44', duracaoP: '01:06', hInicioR: '11:35', hFimR: '13:20', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 3, diaIdx: 1 },
  { op: '13404237', tipo: 'DENS', fileCliente: '11307 ENC', produto: 'N-QV2-NAT-45X240-0101-ADE-SDS', calibre: '45x24', massas: '2,9-4,1', qtdEntrada: 50.0, obsPi: 'ENCOMENDA - Continua a 03/06', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Linha 10', estado: 'PI por liberar', hInicioP: '10:49', hFimP: '15:54', duracaoP: '04:05', hInicioR: '13:40', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 4, diaIdx: 1 },
  { op: '13404227', tipo: 'DENS', fileCliente: '11257 Righetti', produto: 'N-QV2-NAT-45X260-0202-ADE-SDS', calibre: '45x26', massas: '3,4-4,5', qtdEntrada: 36.4, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Linha 9', estado: 'PI por liberar', hInicioP: '07:00', hFimP: '16:10', duracaoP: '08:10', hInicioR: '08:10', hFimR: '15:45', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 2, diaIdx: 1 },
  { op: '13404237', tipo: 'DENS', fileCliente: '11307 ENC', produto: 'N-QV2-NAT-45X240-0101-ADE-SDS', calibre: '45x24', massas: '2,9-4,1', qtdEntrada: 87.2, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Linha 10', estado: 'PI por liberar', hInicioP: '07:00', hFimP: '15:03', duracaoP: '07:03', hInicioR: '', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 5, diaIdx: 2 },
  { op: '13404265', tipo: 'DENS', fileCliente: '19784 ENC', produto: 'N-QV2-NAT-49X250-0101-ADE-SDS', calibre: '49x25', massas: '3,5 - 4,8', qtdEntrada: 10.0, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Linha 10', estado: 'PI por liberar', hInicioP: '15:08', hFimP: '16:01', duracaoP: '00:53', hInicioR: '', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 6, diaIdx: 2 },
  { op: '13404267', tipo: 'DENS', fileCliente: '18342 ENC', produto: 'N-QV2-NAT-49X240-0101-ADE-SDS-TA', calibre: '49x24', massas: '3,2-4,6', qtdEntrada: 3.5, obsPi: 'ENCOMENDA', destino: 'KANBAN VOCUS', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Linha 10', estado: 'PI por liberar', hInicioP: '16:06', hFimP: '16:28', duracaoP: '00:21', hInicioR: '', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 7, diaIdx: 2 },
  { op: '13404237', tipo: 'DENS', fileCliente: '11307 ENC', produto: 'N-QV2-NAT-45X240-0101-ADE-SDS', calibre: '45x24', massas: '2,9-4,1', qtdEntrada: 35.0, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Linha 9', estado: 'PI por liberar', hInicioP: '07:00', hFimP: '15:51', duracaoP: '07:51', hInicioR: '', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 3, diaIdx: 2 },
  { op: '13404228', tipo: 'DENS', fileCliente: '11257 Righetti', produto: 'N-QV2-NAT-45X260-0202-ADE-SDS', calibre: '45x26', massas: '3,4-4,5', qtdEntrada: 5.0, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Linha 9', estado: 'PI por liberar', hInicioP: '15:56', hFimP: '17:08', duracaoP: '01:11', hInicioR: '', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 4, diaIdx: 2 },
  { op: '13404267', tipo: 'DENS', fileCliente: '18342 ENC', produto: 'N-QV2-NAT-49X240-0101-ADE-SDS-TA', calibre: '49x24', massas: '3,2-4,6', qtdEntrada: 60.0, obsPi: 'ENCOMENDA', destino: 'KANBAN VOCUS', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Linha 10', estado: 'PI por liberar', hInicioP: '07:00', hFimP: '11:53', duracaoP: '04:53', hInicioR: '', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W24', sortIdx: 0, diaIdx: 0 },
  { op: '13404266', tipo: 'DENS', fileCliente: '20080 LEGACY', produto: 'N-QV2-L03-49X240-1212-CDE-SDS-LEG', calibre: '49x24', massas: '3,2-4,3', qtdEntrada: 10.6, obsPi: 'ENCOMENDA', destino: 'KANBAN VOCUS', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Linha 10', estado: 'PI por liberar', hInicioP: '11:58', hFimP: '13:53', duracaoP: '00:55', hInicioR: '', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W24', sortIdx: 1, diaIdx: 0 },
  { op: '13404268', tipo: 'DENS', fileCliente: '10461 ANT', produto: 'N-QV2-NAT-49X240-0202-ADE-SDS-LT4-ANT', calibre: '49x24', massas: '3,2-4,0', qtdEntrada: 25.0, obsPi: 'ENCOMENDA - Continua a 09/06', destino: 'KANBAN LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Linha 10', estado: 'PI por liberar', hInicioP: '13:58', hFimP: '16:03', duracaoP: '02:05', hInicioR: '', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W24', sortIdx: 2, diaIdx: 0 },
  { op: '13404269', tipo: 'DENS', fileCliente: '10461 ANT', produto: 'N-QV2-NAT-49X240-0202-ADE-SDS-LT4-ANT', calibre: '49x24', massas: '3,2-4,0', qtdEntrada: 37.8, obsPi: 'ENCOMENDA - Continua a 09/06', destino: 'KANBAN LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Linha 9', estado: 'PI por liberar', hInicioP: '07:00', hFimP: '16:29', duracaoP: '08:29', hInicioR: '', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W24', sortIdx: 0, diaIdx: 0 },
  { op: '13404268', tipo: 'DENS', fileCliente: '10461 ANT', produto: 'N-QV2-NAT-49X240-0202-ADE-SDS-LT4-ANT', calibre: '49x24', massas: '3,2-4,0', qtdEntrada: 76.2, obsPi: 'ENCOMENDA', destino: 'KANBAN LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Linha 10', estado: 'PI por liberar', hInicioP: '07:00', hFimP: '14:10', duracaoP: '06:10', hInicioR: '', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W24', sortIdx: 3, diaIdx: 1 },
  { op: '13404269', tipo: 'DENS', fileCliente: '10461 ANT', produto: 'N-QV2-NAT-49X240-0202-ADE-SDS-LT4-ANT', calibre: '49x24', massas: '3,2-4,0', qtdEntrada: 40.0, obsPi: 'ENCOMENDA', destino: 'KANBAN LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Linha 9', estado: 'PI por liberar', hInicioP: '07:00', hFimP: '16:58', duracaoP: '08:58', hInicioR: '', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W24', sortIdx: 1, diaIdx: 1 },
];

// ============================================================
// Helpers
// ============================================================
function rowToOp(row) {
  // O cliente espera o objecto da OP com `id` numérico no topo, e todos os
  // campos do `payload` no mesmo nível. Devolvemos um spread.
  const payload = row.payload || {};
  return Object.assign({}, payload, { id: row.id });
}

function deriveColumns(op) {
  return {
    maquina:  op.maquina || null,
    week_key: op.weekKey || null,
    sort_idx: (op.sortIdx != null && !isNaN(op.sortIdx)) ? Number(op.sortIdx) : 0,
    dia_idx:  (op.diaIdx  != null && !isNaN(op.diaIdx))  ? Number(op.diaIdx)  : 0,
  };
}

function stripId(op) {
  const copy = Object.assign({}, op);
  delete copy.id;
  return copy;
}

// ============================================================
// API pública
// ============================================================
function isConnected() { return pool !== null; }

async function initSchema() {
  if (!pool) return;
  const sqlPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  await pool.query(sql);
  console.log('[db] Schema inicializado.');
}

async function seedIfEmpty() {
  if (!pool) return;
  const r = await pool.query('SELECT COUNT(*)::int AS n FROM ops');
  if (r.rows[0].n > 0) {
    console.log(`[db] Tabela ops já tem ${r.rows[0].n} OPs — sem seed.`);
    return;
  }
  console.log('[db] Tabela ops vazia — a inserir 19 OPs iniciais...');
  for (const op of SEED_OPS) {
    const d = deriveColumns(op);
    await pool.query(
      `INSERT INTO ops (op, payload, maquina, week_key, sort_idx, dia_idx, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [op.op, JSON.stringify(op), d.maquina, d.week_key, d.sort_idx, d.dia_idx, 'seed']
    );
  }
  console.log(`[db] Seed concluído (${SEED_OPS.length} OPs).`);
}

async function listOps() {
  if (!pool) throw new Error('Sem ligação à BD.');
  const r = await pool.query(
    `SELECT id, payload FROM ops ORDER BY id ASC`
  );
  return r.rows.map(rowToOp);
}

async function getOp(id) {
  if (!pool) throw new Error('Sem ligação à BD.');
  const r = await pool.query(`SELECT id, payload FROM ops WHERE id = $1`, [id]);
  if (!r.rows.length) return null;
  return rowToOp(r.rows[0]);
}

async function createOp(op, updatedBy) {
  if (!pool) throw new Error('Sem ligação à BD.');
  const clean = stripId(op);
  const d = deriveColumns(clean);
  const r = await pool.query(
    `INSERT INTO ops (op, payload, maquina, week_key, sort_idx, dia_idx, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, payload`,
    [clean.op || '', JSON.stringify(clean), d.maquina, d.week_key, d.sort_idx, d.dia_idx, updatedBy || 'unknown']
  );
  return rowToOp(r.rows[0]);
}

async function updateOp(id, op, updatedBy) {
  if (!pool) throw new Error('Sem ligação à BD.');
  const clean = stripId(op);
  const d = deriveColumns(clean);
  const r = await pool.query(
    `UPDATE ops
        SET op = $1, payload = $2, maquina = $3, week_key = $4,
            sort_idx = $5, dia_idx = $6, updated_at = NOW(), updated_by = $7
      WHERE id = $8
      RETURNING id, payload`,
    [clean.op || '', JSON.stringify(clean), d.maquina, d.week_key, d.sort_idx, d.dia_idx, updatedBy || 'unknown', id]
  );
  if (!r.rows.length) return null;
  return rowToOp(r.rows[0]);
}

async function deleteOp(id) {
  if (!pool) throw new Error('Sem ligação à BD.');
  const r = await pool.query(`DELETE FROM ops WHERE id = $1 RETURNING id`, [id]);
  return r.rows.length > 0;
}

async function getSettings() {
  if (!pool) throw new Error('Sem ligação à BD.');
  const r = await pool.query(`SELECT key, value FROM settings`);
  const out = {};
  for (const row of r.rows) out[row.key] = row.value;
  return out;
}

async function putSettings(settings) {
  if (!pool) throw new Error('Sem ligação à BD.');
  if (!settings || typeof settings !== 'object') throw new Error('Settings inválidas.');
  for (const [k, v] of Object.entries(settings)) {
    await pool.query(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [k, JSON.stringify(v)]
    );
  }
  return getSettings();
}

async function resetOps(updatedBy) {
  if (!pool) throw new Error('Sem ligação à BD.');
  await pool.query('DELETE FROM ops');
  // Re-seed (forçado, ignora seedIfEmpty porque acabámos de limpar)
  for (const op of SEED_OPS) {
    const d = deriveColumns(op);
    await pool.query(
      `INSERT INTO ops (op, payload, maquina, week_key, sort_idx, dia_idx, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [op.op, JSON.stringify(op), d.maquina, d.week_key, d.sort_idx, d.dia_idx, updatedBy || 'reset']
    );
  }
  return listOps();
}

module.exports = {
  isConnected,
  initSchema,
  seedIfEmpty,
  listOps,
  getOp,
  createOp,
  updateOp,
  deleteOp,
  getSettings,
  putSettings,
  resetOps,
  SEED_OPS,
};
