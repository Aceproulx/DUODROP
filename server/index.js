/* =================================================================
   DUODROP — Express Server (port 3000)
   Serves frontend static files AND API routes
   ================================================================= */
require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const path     = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/songs',   require('./routes/songs'));
app.use('/api/upload',  require('./routes/upload'));
app.use('/api/artists', require('./routes/artists'));
app.use('/api/admin',   require('./routes/admin'));
app.use('/api/seed',    require('./routes/seed'));

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', app: 'DUODROP', time: new Date().toISOString() }));

// ── Serve frontend static files ───────────────────────────────
// Express serves everything in the parent folder (DUODROP FINAL)
app.use(express.static(path.join(__dirname, '..')));

// Catch-all: always serve index.html for SPA navigation
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('');
    console.log('  🎵  DUODROP Server is live!');
    console.log(`  👉  http://localhost:${PORT}`);
    console.log('');
  });
}

module.exports = app;
