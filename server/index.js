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

// ── Public Config ─────────────────────────────────────────────
app.get('/api/config', (_req, res) => {
  res.json({
    firebase: {
      apiKey: process.env.FIREBASE_WEB_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      databaseURL: process.env.FIREBASE_DATABASE_URL,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
    }
  });
});

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
