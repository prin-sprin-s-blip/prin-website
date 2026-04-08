// src/server.js
require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const morgan   = require('morgan');
const rateLimit = require('express-rate-limit');
const path     = require('path');

const quotesRouter  = require('./routes/quotes');
const pricingRouter = require('./routes/pricing');
const adminRouter   = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── TRUST PROXY (needed when behind Nginx / Railway / Render) ──
app.set('trust proxy', 1);

// ── SECURITY HEADERS ───────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // keep off so embedded maps/fonts work
  crossOriginEmbedderPolicy: false,
}));

// ── CORS ───────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    // Allow curl / mobile / no-origin requests
    if (!origin) return cb(null, true);
    // If no origins configured, allow all (useful during development)
    if (allowedOrigins.length === 0) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Admin-Secret'],
}));

// ── BODY PARSING ───────────────────────────────────────────────
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));

// ── REQUEST LOGGING ────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── RATE LIMITING ──────────────────────────────────────────────

// Strict limit for quote submissions — prevent spam
const quoteLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 8,
  message: { success: false, error: 'Too many quote requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limit
const apiLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

// ── STATIC FILES ───────────────────────────────────────────────
// Serves public/index.html (your frontend)
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '1h',
  etag: true,
}));

// ── API ROUTES ─────────────────────────────────────────────────
app.use('/api/quotes', quoteLimit, quotesRouter);
app.use('/api',        apiLimit,   pricingRouter);
app.use('/admin',                  adminRouter);

// ── HEALTH CHECK ───────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    service:   'Chrispine Landscaping',
    timestamp: new Date().toISOString(),
    uptime:    Math.floor(process.uptime()) + 's',
  });
});

// ── SPA FALLBACK ───────────────────────────────────────────────
// For any non-API route, serve index.html so the single-page frontend works
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── GLOBAL ERROR HANDLER ───────────────────────────────────────
app.use((err, req, res, _next) => {
  // CORS errors
  if (err.message?.startsWith('CORS')) {
    return res.status(403).json({ error: err.message });
  }
  console.error('[ERROR]', err.message);
  res.status(500).json({ success: false, error: 'Internal server error.' });
});

// ── START ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  const line = '─'.repeat(50);
  console.log(`
┌${line}┐
│  🌿  Chrispine Landscaping Backend              │
│  URL     : http://localhost:${PORT}                │
│  Admin   : http://localhost:${PORT}/admin?key=...  │
│  Health  : http://localhost:${PORT}/health         │
│  Mode    : ${(process.env.NODE_ENV || 'development').padEnd(38)}│
└${line}┘
  `);
});

module.exports = app;
