// ============================================================
// Planeamento DENSIDADES — Servidor estático para Railway
// ============================================================
// Serve o protótipo HTML standalone. Persistência continua em
// localStorage do browser + BackupSync (File System Access API).
// Não há backend de dados — é puramente um host de assets.

const express = require('express');
const compression = require('compression');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Compressão gzip (reduz transferência do HTML ~5x)
app.use(compression());

// Cache headers — HTML sempre fresh (para apanhar deploys novos),
// assets estáticos com cache curto
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
  next();
});

// Servir conteúdo estático da pasta /public
app.use(express.static(path.join(__dirname, 'public'), {
  index: 'index.html',
  extensions: ['html'],
}));

// Healthcheck para Railway
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'planeamento-densidades', ts: new Date().toISOString() });
});

// Fallback — qualquer rota não-conhecida → index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[planeamento-densidades] A servir na porta ${PORT}`);
});
