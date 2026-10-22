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
  { op: '13404239', tipo: 'DENS', fileCliente: '10486', produto: 'N-QV2-NAT-45X240-0101-ADE-SDS-TA', calibre: '45x24', massas: '2,9-4,1', qtdEntrada: 66.3, obsPi: '', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '07:00', hFimP: '13:23', duracaoP: '05:23', hInicioR: '', hFimR: '13:20', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 0, diaIdx: 0 },
  { op: '13404262', tipo: 'DENS', fileCliente: '13913 ENC', produto: 'N-QV2-NAT-45X242-1111-ADE-SDS-TA', calibre: '45x24', massas: '2,9 - 3,9', qtdEntrada: 40.0, obsPi: 'ENCOMENDA - Continua a 02/06', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '13:28', hFimP: '16:45', duracaoP: '03:17', hInicioR: '13:25', hFimR: '16:45', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 1, diaIdx: 0 },
  { op: '13404260', tipo: 'DENS', fileCliente: '13385 ENC', produto: 'N-QV2-NAT-49X240-0101-ADE-SDS-TA', calibre: '49x24', massas: '3,2-4,3', qtdEntrada: 15.0, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 3 - Linha 10', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '07:00', hFimP: '10:25', duracaoP: '03:25', hInicioR: '09:15', hFimR: '12:30', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 0, diaIdx: 0 },
  { op: '13404263', tipo: 'DENS', fileCliente: '11704', produto: 'N-QV2-NAT-49X242-0101-ADE-SDS-TA', calibre: '49x24', massas: '3,2-4,6', qtdEntrada: 20.0, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 3 - Linha 10', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '10:30', hFimP: '16:01', duracaoP: '04:31', hInicioR: '14:20', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 1, diaIdx: 0 },
  { op: '13404259', tipo: 'DENS', fileCliente: '10882 ENC', produto: 'N-QV2-NAT-49X242-0101-ADE-SDS-TA', calibre: '49x24', massas: '3,2-4,3', qtdEntrada: 30.8, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '07:00', hFimP: '09:32', duracaoP: '02:32', hInicioR: '08:20', hFimR: '11:30', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 2, diaIdx: 1 },
  { op: '13404264', tipo: 'DENS', fileCliente: 'CSP2 AI', produto: 'N-QV2-323-49X240-1010-ADE-CRU', calibre: '49x24', massas: '3,1 - 4,6', qtdEntrada: 12.8, obsPi: 'CSP2 AI', destino: 'CSP2 AI', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'CSP2-AI por liberar', hInicioP: '09:37', hFimP: '10:44', duracaoP: '01:06', hInicioR: '11:35', hFimR: '13:20', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 3, diaIdx: 1 },
  { op: '13404237', tipo: 'DENS', fileCliente: '11307 ENC', produto: 'N-QV2-NAT-45X240-0101-ADE-SDS', calibre: '45x24', massas: '2,9-4,1', qtdEntrada: 50.0, obsPi: 'ENCOMENDA - Continua a 03/06', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '10:49', hFimP: '15:54', duracaoP: '04:05', hInicioR: '13:40', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 4, diaIdx: 1 },
  { op: '13404227', tipo: 'DENS', fileCliente: '11257 Righetti', produto: 'N-QV2-NAT-45X260-0202-ADE-SDS', calibre: '45x26', massas: '3,4-4,5', qtdEntrada: 36.4, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 3 - Linha 10', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '07:00', hFimP: '16:10', duracaoP: '08:10', hInicioR: '08:10', hFimR: '15:45', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 2, diaIdx: 1 },
  { op: '13404237', tipo: 'DENS', fileCliente: '11307 ENC', produto: 'N-QV2-NAT-45X240-0101-ADE-SDS', calibre: '45x24', massas: '2,9-4,1', qtdEntrada: 87.2, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '07:00', hFimP: '15:03', duracaoP: '07:03', hInicioR: '', hFimR: '16:00', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 5, diaIdx: 2 },
  { op: '13404265', tipo: 'DENS', fileCliente: '19784 ENC', produto: 'N-QV2-NAT-49X250-0101-ADE-SDS', calibre: '49x25', massas: '3,5 - 4,8', qtdEntrada: 10.0, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '15:08', hFimP: '16:01', duracaoP: '00:53', hInicioR: '16:05', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 6, diaIdx: 2 },
  { op: '13404267', tipo: 'DENS', fileCliente: '18342 ENC', produto: 'N-QV2-NAT-49X240-0101-ADE-SDS-TA', calibre: '49x24', massas: '3,2-4,6', qtdEntrada: 13.5, obsPi: 'ENCOMENDA', destino: 'KANBAN VOCUS', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '16:06', hFimP: '17:16', duracaoP: '01:09', hInicioR: '', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 7, diaIdx: 2 },
  { op: '13404237', tipo: 'DENS', fileCliente: '11307 ENC', produto: 'N-QV2-NAT-45X240-0101-ADE-SDS', calibre: '45x24', massas: '2,9-4,1', qtdEntrada: 35.0, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 3 - Linha 10', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '07:00', hFimP: '15:51', duracaoP: '07:51', hInicioR: '', hFimR: '16:00', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 3, diaIdx: 2 },
  { op: '13404228 - KB ', tipo: 'DENS', fileCliente: '11257 Righetti', produto: 'N-QV2-NAT-45X260-0202-ADE-SDS', calibre: '45x26', massas: '3,4-4,5', qtdEntrada: 35.0, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 3 - Linha 10', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '15:56', hFimP: '00:18', duracaoP: '07:51', hInicioR: '16:25', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W23', sortIdx: 4, diaIdx: 2 },
  { op: '13404267', tipo: 'DENS', fileCliente: '18342 ENC', produto: 'N-QV2-NAT-49X240-0101-ADE-SDS-TA', calibre: '49x24', massas: '3,2-4,6', qtdEntrada: 50.0, obsPi: 'ENCOMENDA', destino: 'KANBAN VOCUS', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '08:00', hFimP: '13:05', duracaoP: '04:05', hInicioR: '08:10', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W24', sortIdx: 0, diaIdx: 0 },
  { op: '13404266', tipo: 'DENS', fileCliente: '20080 LEGACY', produto: 'N-QV2-L03-49X240-1212-CDE-SDS-LEG', calibre: '49x24', massas: '3,2-4,3', qtdEntrada: 10.6, obsPi: 'ENCOMENDA', destino: 'KANBAN VOCUS', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '13:10', hFimP: '14:05', duracaoP: '00:55', hInicioR: '13:00', hFimR: '13:40', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W24', sortIdx: 1, diaIdx: 0 },
  { op: '13404268', tipo: 'DENS', fileCliente: '10461 ANT', produto: 'N-QV2-NAT-49X240-0202-ADE-SDS-LT4-ANT', calibre: '49x24', massas: '3,2-4,0', qtdEntrada: 35.0, obsPi: 'ENCOMENDA - Continua a 09/06', destino: 'KANBAN LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '14:10', hFimP: '17:03', duracaoP: '02:53', hInicioR: '13:50', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W24', sortIdx: 2, diaIdx: 0 },
  { op: '13404269', tipo: 'DENS', fileCliente: '10461 ANT', produto: 'N-QV2-NAT-49X240-0202-ADE-SDS-LT4-ANT', calibre: '49x24', massas: '3,2-4,0', qtdEntrada: 37.8, obsPi: 'ENCOMENDA - Continua a 09/06', destino: 'KANBAN LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 3 - Linha 10', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '08:00', hFimP: '17:29', duracaoP: '08:29', hInicioR: '08:25', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W24', sortIdx: 0, diaIdx: 0 },
  { op: '13404268', tipo: 'DENS', fileCliente: '10461 ANT', produto: 'N-QV2-NAT-49X240-0202-ADE-SDS-LT4-ANT', calibre: '49x24', massas: '3,2-4,0', qtdEntrada: 66.2, obsPi: 'ENCOMENDA', destino: 'KANBAN LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '08:00', hFimP: '14:22', duracaoP: '05:22', hInicioR: '08:00', hFimR: '14:45', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W24', sortIdx: 3, diaIdx: 1 },
  { op: '13404280', tipo: 'DENS', fileCliente: '11195 ENC', produto: 'N-QV2-NAT-49X240-1010-ADE-SDS-TA', calibre: '49x24', massas: '3,2-4,3', qtdEntrada: 29.9, obsPi: 'ENCOMENDA', destino: 'KANBAN LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '14:27', hFimP: '16:56', duracaoP: '02:28', hInicioR: '14:50', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W24', sortIdx: 4, diaIdx: 1 },
  { op: '13404269', tipo: 'DENS', fileCliente: '10461 ANT', produto: 'N-QV2-NAT-49X240-0202-ADE-SDS-LT4-ANT', calibre: '49x24', massas: '3,2-4,0', qtdEntrada: 40.0, obsPi: 'ENCOMENDA', destino: 'KANBAN LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 3 - Linha 10', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '08:00', hFimP: '17:58', duracaoP: '08:58', hInicioR: '08:00', hFimR: '13:40', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W24', sortIdx: 1, diaIdx: 1 },
  { op: '13404277', tipo: 'DENS', fileCliente: '20080 LEGACY', produto: 'N-QV2-L03-49X240-1111-CDE-CRU-LEG', calibre: '49x24', massas: '3,2-4,3', qtdEntrada: 44.0, obsPi: 'ENCOMENDA', destino: 'KANBAN X100', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '07:00', hFimP: '10:36', duracaoP: '03:36', hInicioR: '08:50', hFimR: '13:10', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W24', sortIdx: 5, diaIdx: 3 },
  { op: '13404240', tipo: 'DENS', fileCliente: '10486', produto: 'N-QV2-NAT-45X240-0101-ADE-SDS-TA', calibre: '45x24', massas: '2,9-4,1', qtdEntrada: 54.4, obsPi: 'CONTINUA A 15/06', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '10:41', hFimP: '16:07', duracaoP: '04:26', hInicioR: '13:15', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W24', sortIdx: 6, diaIdx: 3 },
  { op: '13404273', tipo: 'DENS', fileCliente: '20080 LEGACY', produto: 'N-QV2-L03-54X240-1111-CDE-SDS-LEG_SC', calibre: '54x24', massas: '3,5-4,7', qtdEntrada: 12.6, obsPi: 'ENCOMENDA', destino: 'KANBAN VOCUS', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 3 - Linha 10', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '07:00', hFimP: '09:52', duracaoP: '02:52', hInicioR: '', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W24', sortIdx: 2, diaIdx: 3 },
  { op: '13404230', tipo: 'DENS', fileCliente: '11257 Righetti', produto: 'N-QV2-NAT-45X260-0303-ADE-SDS', calibre: '45x26', massas: '3,4-4,5', qtdEntrada: 37.6, obsPi: 'ENCOMENDA - CONTINUA A 15/06', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 3 - Linha 10', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '09:57', hFimP: '19:24', duracaoP: '08:26', hInicioR: '09:10', hFimR: '16:40', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W24', sortIdx: 3, diaIdx: 3 },
  { op: '13404240', tipo: 'DENS', fileCliente: '10486', produto: 'N-QV2-NAT-45X240-0101-ADE-SDS-TA', calibre: '45x24', massas: '2,9-4,1', qtdEntrada: 20.0, obsPi: '', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '07:00', hFimP: '08:41', duracaoP: '01:41', hInicioR: '', hFimR: '10:00', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W24', sortIdx: 7, diaIdx: 4 },
  { op: '13404286', tipo: 'DENS', fileCliente: '18779  ENC', produto: 'N-QV2-L03-49X240-0202-ADE-CRU', calibre: '49x24', massas: '3,2-4,3', qtdEntrada: 10.0, obsPi: 'ENCOMENDA', destino: 'KB MQ', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '08:46', hFimP: '09:39', duracaoP: '00:53', hInicioR: '10:10', hFimR: '11:10', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W24', sortIdx: 8, diaIdx: 4 },
  { op: '13404270', tipo: 'DENS', fileCliente: '11058 ENC', produto: 'N-QV2-NAT-45X240-0101-ADE-SDS-TA', calibre: '45x24', massas: '2,9 - 4,1', qtdEntrada: 64.6, obsPi: 'ENCOMENDA - continua a 15-06', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '09:44', hFimP: '15:59', duracaoP: '05:15', hInicioR: '11:40', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W24', sortIdx: 9, diaIdx: 4 },
  { op: '13404235', tipo: 'DENS', fileCliente: '11257 Righetti', produto: 'N-QV2-NAT-45X260-0202-ADE-SDS', calibre: '45x26', massas: '3,4-4,5', qtdEntrada: 34.1, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 3 - Linha 10', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '07:00', hFimP: '15:39', duracaoP: '07:39', hInicioR: '07:00', hFimR: '13:05', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W24', sortIdx: 4, diaIdx: 4 },
  { op: '13404270', tipo: 'DENS', fileCliente: '11058 ENC', produto: 'N-QV2-NAT-45X240-0101-ADE-SDS-TA', calibre: '45x24', massas: '2,9 - 4,1', qtdEntrada: 40.0, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '08:00', hFimP: '11:17', duracaoP: '03:17', hInicioR: '08:05', hFimR: '10:10', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W25', sortIdx: 0, diaIdx: 0 },
  { op: '13404279', tipo: 'DENS', fileCliente: '11058 ENC', produto: 'N-QV2-NAT-45X240-0101-ADE-SDS', calibre: '45x24', massas: '2,9 - 4,1', qtdEntrada: 57.2, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '11:22', hFimP: '17:01', duracaoP: '04:39', hInicioR: '10:15', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W25', sortIdx: 1, diaIdx: 0 },
  { op: '13404278', tipo: 'DENS', fileCliente: '11058 ENC', produto: 'N-QV2-NAT-45X240-0202-ADE-SDS', calibre: '45x24', massas: '2,9 - 4,1', qtdEntrada: 15.0, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '17:06', hFimP: '18:23', duracaoP: '01:17', hInicioR: '', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W25', sortIdx: 2, diaIdx: 0 },
  { op: '13404279', tipo: 'DENS', fileCliente: '11058 ENC', produto: 'N-QV2-NAT-45X240-0101-ADE-SDS', calibre: '45x24', massas: '2,9 - 4,1', qtdEntrada: 36.6, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 3 - Linha 10', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '08:00', hFimP: '17:12', duracaoP: '08:12', hInicioR: '10:30', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W25', sortIdx: 0, diaIdx: 0 },
  { op: '13404278', tipo: 'DENS', fileCliente: '11058 ENC', produto: 'N-QV2-NAT-45X240-0202-ADE-SDS', calibre: '45x24', massas: '2,9 - 4,1', qtdEntrada: 92.8, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '08:00', hFimP: '16:30', duracaoP: '07:30', hInicioR: '', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W25', sortIdx: 3, diaIdx: 1 },
  { op: '13404283', tipo: 'DENS', fileCliente: '20030 CSP2', produto: 'N-QV2-NAT-49X240-0101-ADE-SDS', calibre: '49x24', massas: '3,2-4,3', qtdEntrada: 6.3, obsPi: 'CONTINUA A 17/06', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '16:35', hFimP: '17:10', duracaoP: '00:35', hInicioR: '', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W25', sortIdx: 4, diaIdx: 1 },
  { op: '13404287', tipo: 'DENS', fileCliente: 'CSP2 AI', produto: 'N-QV2-323-49X260-1001-ADE-ADS', calibre: '49x26', massas: '3,5 - 5,0', qtdEntrada: 15.8, obsPi: 'CSP2 AI', destino: 'CSP2 AI', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 3 - Linha 10', inicioMode: 'manual', estado: 'CSP2-AI por liberar', hInicioP: '08:00', hFimP: '11:35', duracaoP: '03:35', hInicioR: '', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W25', sortIdx: 1, diaIdx: 1 },
  { op: '13404278', tipo: 'DENS', fileCliente: '11058 ENC', produto: 'N-QV2-NAT-45X240-0202-ADE-SDS', calibre: '45x24', massas: '2,9 - 4,1', qtdEntrada: 20.0, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 3 - Linha 10', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '11:40', hFimP: '17:11', duracaoP: '04:31', hInicioR: '', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W25', sortIdx: 2, diaIdx: 1 },
  { op: '13404283', tipo: 'DENS', fileCliente: '20030 CSP2', produto: 'N-QV2-NAT-49X240-0101-ADE-SDS', calibre: '49x24', massas: '3,2-4,3', qtdEntrada: 60.0, obsPi: '', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 1 - Linha 9', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '07:00', hFimP: '11:53', duracaoP: '04:53', hInicioR: '', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W25', sortIdx: 5, diaIdx: 2 },
  { op: '13404285', tipo: 'DENS', fileCliente: '13526 ENC', produto: 'N-QV2-NAT-49X260-0101-ADE-SDS', calibre: '49x26', massas: '3,7 - 5,0', qtdEntrada: 11.5, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 3 - Linha 10', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '07:00', hFimP: '09:37', duracaoP: '02:37', hInicioR: '', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W25', sortIdx: 3, diaIdx: 2 },
  { op: '13404255', tipo: 'DENS', fileCliente: '11257 Righetti', produto: 'N-QV2-NAT-45X260-0303-ADE-SDS', calibre: '45x26', massas: '3,4-4,5', qtdEntrada: 25.5, obsPi: 'ENCOMENDA - CONTINUA A 18/06', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 3 - Linha 10', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '09:42', hFimP: '16:28', duracaoP: '05:45', hInicioR: '', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W25', sortIdx: 4, diaIdx: 2 },
  { op: '13404255', tipo: 'DENS', fileCliente: '11257 Righetti', produto: 'N-QV2-NAT-45X260-0303-ADE-SDS', calibre: '45x26', massas: '3,4-4,5', qtdEntrada: 10.0, obsPi: 'ENCOMENDA', destino: 'KB LAV', loteAde: '', qtdEntradaAde: 0, qtdFinalAde: 0, pctAde: 0, ode: 0, rdhRhh: 0, rdlRll: 0, qtdReprocReal: 0, qtdReprocEstimada: 0, colaborador: '', maquina: 'Maq 3 - Linha 10', inicioMode: 'manual', estado: 'Por liberar', hInicioP: '07:00', hFimP: '09:18', duracaoP: '02:18', hInicioR: '', hFimR: '', tempoAtraso: '', horaExtra: '', obs: '', weekKey: '2026-W25', sortIdx: 5, diaIdx: 3 },
];

// ============================================================
// Helpers
// ============================================================
function rowToOp(row) {
  // O cliente espera o objecto da OP com `id` numérico no topo, e todos os
  // campos do `payload` no mesmo nível. Devolvemos um spread.
  // Adicionamos `_ts` = updated_at em ISO, para optimistic locking (PATCH/PUT com versão).
  const payload = row.payload || {};
  const _ts = row.updated_at ? new Date(row.updated_at).toISOString() : null;
  return Object.assign({}, payload, { id: row.id, _ts });
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
  // Backup tables — criadas em paralelo com o schema principal
  await ensureBackupSchema();
  // Notifications
  await ensureNotificationsSchema();
}

// ============================================================
// Notificações — avisos entre perfis (Produção → Planeador, etc.)
// ============================================================
async function ensureNotificationsSchema() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      message     TEXT,
      severity    TEXT NOT NULL DEFAULT 'info',   -- info | warning | error
      recipient   TEXT NOT NULL DEFAULT 'planeador',
      ref_op_id   INTEGER,
      source      TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      acked_at    TIMESTAMPTZ,
      acked_by    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_notif_recipient_unread ON notifications (recipient, acked_at) WHERE acked_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_notif_recipient_time ON notifications (recipient, created_at DESC);
  `);
  console.log('[db] Notifications schema OK.');
}

async function createNotification(n) {
  if (!pool) throw new Error('Sem ligação à BD.');
  const r = await pool.query(
    `INSERT INTO notifications (title, message, severity, recipient, ref_op_id, source)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, created_at`,
    [
      String(n.title || '').slice(0, 200),
      n.message ? String(n.message).slice(0, 1000) : null,
      ['info', 'warning', 'error'].includes(n.severity) ? n.severity : 'info',
      String(n.recipient || 'planeador'),
      n.ref_op_id != null ? parseInt(n.ref_op_id, 10) : null,
      n.source ? String(n.source).slice(0, 50) : null,
    ]
  );
  return r.rows[0];
}

async function listNotifications(recipient, limit = 100) {
  if (!pool) throw new Error('Sem ligação à BD.');
  const lim = Math.min(parseInt(limit, 10) || 100, 500);
  const r = await pool.query(
    `SELECT id, title, message, severity, recipient, ref_op_id, source, created_at, acked_at, acked_by
     FROM notifications
     WHERE recipient = $1
     ORDER BY created_at DESC LIMIT ${lim}`,
    [recipient]
  );
  return r.rows;
}

async function listUnreadNotifications(recipient, limit = 100) {
  if (!pool) throw new Error('Sem ligação à BD.');
  const lim = Math.min(parseInt(limit, 10) || 100, 500);
  const r = await pool.query(
    `SELECT id, title, message, severity, recipient, ref_op_id, source, created_at
     FROM notifications
     WHERE recipient = $1 AND acked_at IS NULL
     ORDER BY created_at DESC LIMIT ${lim}`,
    [recipient]
  );
  return r.rows;
}

async function ackNotificationById(id, ackedBy) {
  if (!pool) throw new Error('Sem ligação à BD.');
  const r = await pool.query(
    `UPDATE notifications SET acked_at = NOW(), acked_by = $2
      WHERE id = $1 AND acked_at IS NULL
      RETURNING id`,
    [id, String(ackedBy || 'unknown').slice(0, 50)]
  );
  return r.rowCount > 0;
}

async function ackAllNotificationsFor(recipient, ackedBy) {
  if (!pool) throw new Error('Sem ligação à BD.');
  const r = await pool.query(
    `UPDATE notifications SET acked_at = NOW(), acked_by = $2
      WHERE recipient = $1 AND acked_at IS NULL`,
    [recipient, String(ackedBy || 'unknown').slice(0, 50)]
  );
  return r.rowCount;
}

// Pruning — manter apenas 30 dias
async function pruneNotifications(days = 30) {
  if (!pool) throw new Error('Sem ligação à BD.');
  const r = await pool.query(
    `DELETE FROM notifications WHERE created_at < NOW() - ($1 || ' days')::interval`,
    [String(days)]
  );
  return r.rowCount;
}

// ------------------------------------------------------------
// Migração one-shot — swap dos nomes de linha (2026-08):
//   "Maq 1 - Linha 10" → "Maq 1 - Linha 9"
//   "Maq 3 - Linha 9"  → "Maq 3 - Linha 10"
// Actua sobre `ops.payload.maquina`, `ops.maquina`, e chaves de settings.
// Idempotente via flag _migration_swap_linhas_v1.
// ------------------------------------------------------------
async function migrateSwapLinhas() {
  if (!pool) return;
  const FLAG = '_migration_swap_linhas_v1';
  const f = await pool.query(`SELECT value FROM settings WHERE key = $1`, [FLAG]);
  if (f.rows.length && f.rows[0].value === true) {
    console.log('[db] migrateSwapLinhas: já corrida (flag presente).');
    return;
  }
  // 1) ops — placeholder → target (evita colisão do swap)
  const TMP1 = '__SWAP_M1__';
  const TMP3 = '__SWAP_M3__';
  const NEW1 = 'Maq 1 - Linha 9';
  const NEW3 = 'Maq 3 - Linha 10';
  const OLD1 = 'Maq 1 - Linha 10';
  const OLD3 = 'Maq 3 - Linha 9';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // ops.payload.maquina + ops.maquina — 2 passos
    // step 1: OLD1 → TMP1, OLD3 → TMP3
    const s1 = await client.query(
      `UPDATE ops
          SET payload = jsonb_set(payload, '{maquina}', to_jsonb($2::text)),
              maquina = $2,
              updated_at = NOW(),
              updated_by = 'migration-swap-linhas'
        WHERE payload->>'maquina' = $1`,
      [OLD1, TMP1]
    );
    const s2 = await client.query(
      `UPDATE ops
          SET payload = jsonb_set(payload, '{maquina}', to_jsonb($2::text)),
              maquina = $2,
              updated_at = NOW(),
              updated_by = 'migration-swap-linhas'
        WHERE payload->>'maquina' = $1`,
      [OLD3, TMP3]
    );
    // step 2: TMP1 → NEW1, TMP3 → NEW3
    const s3 = await client.query(
      `UPDATE ops
          SET payload = jsonb_set(payload, '{maquina}', to_jsonb($2::text)),
              maquina = $2
        WHERE payload->>'maquina' = $1`,
      [TMP1, NEW1]
    );
    const s4 = await client.query(
      `UPDATE ops
          SET payload = jsonb_set(payload, '{maquina}', to_jsonb($2::text)),
              maquina = $2
        WHERE payload->>'maquina' = $1`,
      [TMP3, NEW3]
    );
    console.log(`[db] migrateSwapLinhas: ops ${s1.rowCount}→TMP1, ${s2.rowCount}→TMP3, TMP1→NEW1 ${s3.rowCount}, TMP3→NEW3 ${s4.rowCount}`);

    // 2) Settings — chaves indexadas por máquina
    const settingsKeys = ['capacidades', 'stops', 'turnosPorMaquina', 'calibresPorMaquina', 'tiposPorMaquina'];
    for (const skey of settingsKeys) {
      const r = await client.query(`SELECT value FROM settings WHERE key = $1`, [skey]);
      if (!r.rows.length) continue;
      const bag = r.rows[0].value || {};
      if (typeof bag !== 'object' || Array.isArray(bag)) continue;
      let changed = false;
      // Passo 1: mover OLD → TMP
      if (Object.prototype.hasOwnProperty.call(bag, OLD1)) {
        bag[TMP1] = bag[OLD1]; delete bag[OLD1]; changed = true;
      }
      if (Object.prototype.hasOwnProperty.call(bag, OLD3)) {
        bag[TMP3] = bag[OLD3]; delete bag[OLD3]; changed = true;
      }
      // Passo 2: TMP → NEW (só se NEW ainda não existir)
      if (Object.prototype.hasOwnProperty.call(bag, TMP1)) {
        if (bag[NEW1] == null) bag[NEW1] = bag[TMP1];
        delete bag[TMP1]; changed = true;
      }
      if (Object.prototype.hasOwnProperty.call(bag, TMP3)) {
        if (bag[NEW3] == null) bag[NEW3] = bag[TMP3];
        delete bag[TMP3]; changed = true;
      }
      if (changed) {
        await client.query(
          `UPDATE settings SET value = $1, updated_at = NOW() WHERE key = $2`,
          [JSON.stringify(bag), skey]
        );
        console.log(`[db] migrateSwapLinhas: settings.${skey} actualizado.`);
      }
    }

    // 3) Flag
    await client.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [FLAG, JSON.stringify(true)]
    );
    await client.query('COMMIT');
    console.log('[db] migrateSwapLinhas: OK (flag gravada).');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[db] migrateSwapLinhas ROLLBACK:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

// ============================================================
// Backups automáticos — JSON (retenção por dias) + Excel (retenção por horas)
// ============================================================
async function ensureBackupSchema() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_backups (
      id            SERIAL PRIMARY KEY,
      key           TEXT NOT NULL,
      data          JSONB NOT NULL,
      snapshot_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      triggered_by  TEXT NOT NULL DEFAULT 'auto',
      note          TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_app_backups_key_time ON app_backups (key, snapshot_at DESC);
    CREATE INDEX IF NOT EXISTS idx_app_backups_time ON app_backups (snapshot_at DESC);

    CREATE TABLE IF NOT EXISTS app_backups_xlsx (
      id            SERIAL PRIMARY KEY,
      xlsx_data     BYTEA NOT NULL,
      size_bytes    INTEGER NOT NULL,
      snapshot_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      triggered_by  TEXT NOT NULL DEFAULT 'auto'
    );
    CREATE INDEX IF NOT EXISTS idx_app_backups_xlsx_time ON app_backups_xlsx (snapshot_at DESC);
  `);
  console.log('[db] Backup schema OK (app_backups + app_backups_xlsx).');
}

async function insertBackupJson(key, data, triggeredBy = 'auto', note = null) {
  if (!pool) throw new Error('Sem ligação à BD.');
  const r = await pool.query(
    `INSERT INTO app_backups (key, data, triggered_by, note)
     VALUES ($1, $2::jsonb, $3, $4)
     RETURNING id, snapshot_at`,
    [key, JSON.stringify(data), triggeredBy, note]
  );
  return r.rows[0];
}

async function pruneBackupsJson(days = 30) {
  if (!pool) throw new Error('Sem ligação à BD.');
  const r = await pool.query(
    `DELETE FROM app_backups WHERE snapshot_at < NOW() - ($1 || ' days')::interval`,
    [String(days)]
  );
  return r.rowCount;
}

async function listBackupsJson(key = null, limit = 100) {
  if (!pool) throw new Error('Sem ligação à BD.');
  const lim = Math.min(parseInt(limit, 10) || 100, 500);
  const params = [];
  let where = '';
  if (key) { params.push(key); where = 'WHERE key = $1'; }
  const r = await pool.query(
    `SELECT id, key, snapshot_at, triggered_by, note,
            pg_column_size(data) AS bytes,
            jsonb_typeof(data) AS type,
            CASE
              WHEN jsonb_typeof(data)='array'  THEN jsonb_array_length(data)
              WHEN jsonb_typeof(data)='object' THEN (SELECT count(*) FROM jsonb_object_keys(data))::int
              ELSE NULL
            END AS count
     FROM app_backups ${where}
     ORDER BY snapshot_at DESC LIMIT ${lim}`,
    params
  );
  return r.rows;
}

async function getBackupJson(id) {
  if (!pool) throw new Error('Sem ligação à BD.');
  const r = await pool.query(
    `SELECT id, key, data, snapshot_at, triggered_by, note FROM app_backups WHERE id = $1`,
    [id]
  );
  return r.rows[0] || null;
}

async function insertBackupXlsx(buf, triggeredBy = 'auto') {
  if (!pool) throw new Error('Sem ligação à BD.');
  const r = await pool.query(
    `INSERT INTO app_backups_xlsx (xlsx_data, size_bytes, triggered_by)
     VALUES ($1, $2, $3)
     RETURNING id, snapshot_at`,
    [buf, buf.length, triggeredBy]
  );
  return r.rows[0];
}

// Retenção Excel por horas (default 24h — user pediu 24h)
async function pruneBackupsXlsxByHours(hours = 24) {
  if (!pool) throw new Error('Sem ligação à BD.');
  const r = await pool.query(
    `DELETE FROM app_backups_xlsx WHERE snapshot_at < NOW() - ($1 || ' hours')::interval`,
    [String(hours)]
  );
  return r.rowCount;
}

async function listBackupsXlsx(limit = 20) {
  if (!pool) throw new Error('Sem ligação à BD.');
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const r = await pool.query(
    `SELECT id, snapshot_at, size_bytes, triggered_by
       FROM app_backups_xlsx ORDER BY snapshot_at DESC LIMIT ${lim}`
  );
  return r.rows;
}

async function getBackupXlsx(id) {
  if (!pool) throw new Error('Sem ligação à BD.');
  const r = await pool.query(
    `SELECT id, xlsx_data, snapshot_at, triggered_by FROM app_backups_xlsx WHERE id = $1`,
    [id]
  );
  return r.rows[0] || null;
}


// ------------------------------------------------------------
// Migração — remove prefixo "PI " dos estados antigos
// (executa no arranque; idempotente — só toca em linhas afectadas)
// ------------------------------------------------------------
async function migrateLegacyEstados() {
  if (!pool) return;
  const map = {
    'PI por liberar':   'Por liberar',
    'PI liberado':      'Liberado',
    'PI entregue LOG':  'Entregue LOG',
  };
  let total = 0;
  for (const [oldVal, newVal] of Object.entries(map)) {
    const r = await pool.query(
      `UPDATE ops
          SET payload = jsonb_set(payload, '{estado}', to_jsonb($2::text)),
              updated_at = NOW(),
              updated_by = 'migration-pi'
        WHERE payload->>'estado' = $1`,
      [oldVal, newVal]
    );
    if (r.rowCount > 0) {
      console.log(`[db] migrateLegacyEstados: ${r.rowCount} OPs "${oldVal}" -> "${newVal}"`);
      total += r.rowCount;
    }
  }
  if (total === 0) console.log('[db] migrateLegacyEstados: nenhum estado legacy "PI ..." encontrado.');
}

// ------------------------------------------------------------
// Migração one-shot — zera hInicioP/hFimP/duracaoP (horas planeadas)
// vindas da importação Excel. Após zerar, o cliente recalcula tudo
// automaticamente a partir do início do turno + qtdEntrada/krH.
// Idempotente: usa flag em `settings` para correr apenas 1× por BD.
// ------------------------------------------------------------
async function migrateClearImportedHours() {
  if (!pool) return;
  const FLAG = '_migration_clearImportedHours_v1';
  const f = await pool.query(`SELECT value FROM settings WHERE key = $1`, [FLAG]);
  if (f.rows.length && f.rows[0].value === true) {
    console.log('[db] migrateClearImportedHours: já corrida (flag presente).');
    return;
  }
  const r = await pool.query(
    `UPDATE ops
        SET payload = jsonb_set(
                        jsonb_set(
                          jsonb_set(payload, '{hInicioP}', '""'::jsonb),
                          '{hFimP}', '""'::jsonb),
                        '{duracaoP}', '""'::jsonb),
            updated_at = NOW(),
            updated_by = 'migration-hours'
      WHERE (payload->>'hInicioP') <> '' OR (payload->>'hFimP') <> '' OR (payload->>'duracaoP') <> ''`
  );
  console.log(`[db] migrateClearImportedHours: ${r.rowCount} OPs limpas (hInicioP/hFimP/duracaoP -> '').`);
  await pool.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [FLAG, JSON.stringify(true)]
  );
}

// ------------------------------------------------------------
// Migração one-shot — converte kr (kilo-rolhas) → unidades (×1000)
// Aplica-se a SETTINGS.capacidades.X.{kr8h,krH} e payload das OPs
// Idempotente via flag _migration_unidades_v1 em settings.
// ------------------------------------------------------------
async function migrateToUnidades() {
  if (!pool) return;
  // Defensiva: corre SEMPRE para capacidades — se valor < 1000 (= kilo-rolhas), multiplica por 1000.
  // Para OPs (qtds) usa flag para não correr duplo.
  const FLAG = '_migration_unidades_v1';
  const f = await pool.query(`SELECT value FROM settings WHERE key = $1`, [FLAG]);
  const opsAlreadyDone = f.rows.length && f.rows[0].value === true;
  // 1) Capacidades — kr8h e krH × 1000 (se ainda < 1000, está em kr)
  const capR = await pool.query(`SELECT value FROM settings WHERE key = 'capacidades'`);
  if (capR.rows.length) {
    const caps = capR.rows[0].value || {};
    let changed = false;
    for (const m of Object.keys(caps)) {
      const c = caps[m] || {};
      if (typeof c.kr8h === 'number' && c.kr8h > 0 && c.kr8h < 1000) { c.kr8h = Math.round(c.kr8h * 1000); changed = true; }
      if (typeof c.krH  === 'number' && c.krH  > 0 && c.krH  < 1000) { c.krH  = Math.round(c.krH  * 1000); changed = true; }
    }
    if (changed) {
      await pool.query(
        `UPDATE settings SET value = $1, updated_at = NOW() WHERE key = 'capacidades'`,
        [JSON.stringify(caps)]
      );
      console.log('[db] migrateToUnidades: capacidades ×1000');
    }
  }
  if (opsAlreadyDone) {
    return;
  }
  // 2) OPs — qtdEntrada/qtdFinalAde/qtdEntradaAde/qtdReprocReal/qtdReprocEstimada × 1000
  const opsR = await pool.query(`SELECT id, payload FROM ops`);
  let opsUpdated = 0;
  for (const row of opsR.rows) {
    const p = row.payload || {};
    let changed = false;
    for (const k of ['qtdEntrada','qtdFinalAde','qtdEntradaAde','qtdReprocReal','qtdReprocEstimada']) {
      if (typeof p[k] === 'number' && p[k] > 0 && p[k] < 1000) {
        p[k] = Math.round(p[k] * 1000);
        changed = true;
      }
    }
    if (changed) {
      await pool.query(`UPDATE ops SET payload = $1, updated_at = NOW(), updated_by = 'migration-unidades' WHERE id = $2`,
        [JSON.stringify(p), row.id]);
      opsUpdated++;
    }
  }
  console.log(`[db] migrateToUnidades: ${opsUpdated} OPs convertidas.`);
  await pool.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [FLAG, JSON.stringify(true)]
  );
}

// ------------------------------------------------------------
// Migração one-shot — calibres do formato "45x24" (4 dígitos) para
// "45x240" (6 dígitos). Idempotente via flag _migration_calibre6_v1.
// ------------------------------------------------------------
async function migrateCalibre6Digits() {
  if (!pool) return;
  const FLAG = '_migration_calibre6_v1';
  const f = await pool.query(`SELECT value FROM settings WHERE key = $1`, [FLAG]);
  if (f.rows.length && f.rows[0].value === true) {
    console.log('[db] migrateCalibre6Digits: já corrida.');
    return;
  }
  const r = await pool.query(`SELECT id, payload FROM ops WHERE payload->>'calibre' ~ '^\d{2}x\d{2}$'`);
  let updated = 0;
  for (const row of r.rows) {
    const p = row.payload || {};
    if (p.calibre && /^\d{2}x\d{2}$/.test(p.calibre)) {
      p.calibre = p.calibre + '0';  // 45x24 → 45x240
      await pool.query(`UPDATE ops SET payload = $1, updated_at = NOW(), updated_by = 'migration-calibre6' WHERE id = $2`,
        [JSON.stringify(p), row.id]);
      updated++;
    }
  }
  console.log(`[db] migrateCalibre6Digits: ${updated} OPs convertidas.`);
  await pool.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [FLAG, JSON.stringify(true)]
  );
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
    `SELECT id, payload, updated_at FROM ops ORDER BY id ASC`
  );
  return r.rows.map(rowToOp);
}

async function getOp(id) {
  if (!pool) throw new Error('Sem ligação à BD.');
  const r = await pool.query(`SELECT id, payload, updated_at FROM ops WHERE id = $1`, [id]);
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
     RETURNING id, payload, updated_at`,
    [clean.op || '', JSON.stringify(clean), d.maquina, d.week_key, d.sort_idx, d.dia_idx, updatedBy || 'unknown']
  );
  return rowToOp(r.rows[0]);
}

// updateOp — replace total do payload.
// Novo parâmetro opcional `baseTs`: se fornecido, verifica optimistic locking.
// Se baseTs for passado e não bater com updated_at actual, devolve {_conflict:true, _current: op}.
async function updateOp(id, op, updatedBy, baseTs) {
  if (!pool) throw new Error('Sem ligação à BD.');
  if (baseTs) {
    const cur = await pool.query(`SELECT id, payload, updated_at FROM ops WHERE id = $1`, [id]);
    if (!cur.rows.length) return null;
    const curTs = new Date(cur.rows[0].updated_at).toISOString();
    if (curTs !== baseTs) {
      return { _conflict: true, _current: rowToOp(cur.rows[0]) };
    }
  }
  const clean = stripId(op);
  const d = deriveColumns(clean);
  const r = await pool.query(
    `UPDATE ops
        SET op = $1, payload = $2, maquina = $3, week_key = $4,
            sort_idx = $5, dia_idx = $6, updated_at = NOW(), updated_by = $7
      WHERE id = $8
      RETURNING id, payload, updated_at`,
    [clean.op || '', JSON.stringify(clean), d.maquina, d.week_key, d.sort_idx, d.dia_idx, updatedBy || 'unknown', id]
  );
  if (!r.rows.length) return null;
  return rowToOp(r.rows[0]);
}

// patchOp — merge por campo com optimistic locking (padrão WIM).
// Devolve {notFound:true} | {conflict:true, op: <versão actual>} | {op: <nova versão>}.
// `patch` é o diff: só os campos a alterar. `baseTs` é o updated_at ISO que o cliente viu.
// `allowedFields` opcional — se fornecido, só os campos nessa lista do patch são aplicados
// (o resto é silenciosamente descartado, para enforçar whitelist por perfil).
async function patchOp(id, patch, baseTs, updatedBy, allowedFields) {
  if (!pool) throw new Error('Sem ligação à BD.');
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('Patch inválido (esperava objecto).');
  }
  const cur = await pool.query(`SELECT id, payload, updated_at FROM ops WHERE id = $1`, [id]);
  if (!cur.rows.length) return { notFound: true };
  const curTs = new Date(cur.rows[0].updated_at).toISOString();
  if (baseTs && curTs !== baseTs) {
    return { conflict: true, op: rowToOp(cur.rows[0]) };
  }
  // Filtra o patch pela whitelist, se fornecida
  let effectivePatch = patch;
  if (Array.isArray(allowedFields)) {
    effectivePatch = {};
    for (const k of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(patch, k)) effectivePatch[k] = patch[k];
    }
  }
  const current = cur.rows[0].payload || {};
  const merged = Object.assign({}, current, effectivePatch);
  // Nunca permitir que o patch mude o id (segurança adicional)
  delete merged.id;
  const d = deriveColumns(merged);
  const r = await pool.query(
    `UPDATE ops
        SET op = $1, payload = $2, maquina = $3, week_key = $4,
            sort_idx = $5, dia_idx = $6, updated_at = NOW(), updated_by = $7
      WHERE id = $8
      RETURNING id, payload, updated_at`,
    [merged.op || '', JSON.stringify(merged), d.maquina, d.week_key, d.sort_idx, d.dia_idx, updatedBy || 'unknown', id]
  );
  return { op: rowToOp(r.rows[0]), previous: cur.rows[0].payload || {} };
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

async function deleteAllOps(updatedBy) {
  if (!pool) throw new Error('Sem ligação à BD.');
  const r = await pool.query('DELETE FROM ops');
  console.log(`[db] deleteAllOps: ${r.rowCount} OPs apagadas por ${updatedBy || 'unknown'}`);
  return r.rowCount;
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
  migrateCalibre6Digits,
  migrateToUnidades,
  migrateSwapLinhas,
  deleteAllOps,
  initSchema,
  migrateLegacyEstados,
  migrateClearImportedHours,
  seedIfEmpty,
  listOps,
  getOp,
  createOp,
  updateOp,
  patchOp,
  deleteOp,
  getSettings,
  putSettings,
  resetOps,
  SEED_OPS,
  // Backups
  ensureBackupSchema,
  insertBackupJson,
  pruneBackupsJson,
  listBackupsJson,
  getBackupJson,
  insertBackupXlsx,
  pruneBackupsXlsxByHours,
  listBackupsXlsx,
  getBackupXlsx,
  // Notifications
  ensureNotificationsSchema,
  createNotification,
  listNotifications,
  listUnreadNotifications,
  ackNotificationById,
  ackAllNotificationsFor,
  pruneNotifications,
};
