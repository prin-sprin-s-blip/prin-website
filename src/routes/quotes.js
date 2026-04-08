// src/routes/quotes.js
const express = require('express');
const { body, query, validationResult } = require('express-validator');
const db = require('../config/db');
const { notifyNewQuote, confirmToCustomer } = require('../config/mailer');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ── Helpers ────────────────────────────────────────────────────
function generateRef() {
  const count = db.prepare('SELECT COUNT(*) as c FROM quotes').get().c;
  return `CHR-${String(count + 1).padStart(4, '0')}`;
}

function log(action, detail) {
  db.prepare('INSERT INTO activity_log (action, detail) VALUES (?, ?)').run(action, detail);
}

// ══════════════════════════════════════════════════════════════
// POST /api/quotes
// Called by the "Request a Quote" form on the website
// ══════════════════════════════════════════════════════════════
router.post('/',
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 120 }),
    body('phone').trim().notEmpty().withMessage('Phone number is required').isLength({ max: 30 }),
    body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
    body('size').optional({ checkFalsy: true }).isFloat({ min: 0.1, max: 999999 }),
    body('grass_type').optional().isLength({ max: 60 }),
    body('service').optional().isLength({ max: 80 }),
    body('message').optional().isLength({ max: 600 }).trim(),
  ],
  (req, res) => {
    // Validate
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
      });
    }

    const { name, phone, email, size, grass_type, service, message } = req.body;
    const ref = generateRef();
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

    // Insert into DB
    const info = db.prepare(`
      INSERT INTO quotes (ref, name, phone, email, size_m2, grass_type, service, message, ip_address)
      VALUES (@ref, @name, @phone, @email, @size_m2, @grass_type, @service, @message, @ip)
    `).run({
      ref,
      name,
      phone,
      email:      email || null,
      size_m2:    size ? parseFloat(size) : null,
      grass_type: grass_type || null,
      service:    service || null,
      message:    message || null,
      ip,
    });

    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(info.lastInsertRowid);
    log('new_quote', `ref=${ref} name=${name} phone=${phone}`);

    // Fire emails in the background — don't block the response
    notifyNewQuote(quote).catch(err => console.error('[MAIL ERROR]', err.message));
    confirmToCustomer(quote).catch(err => console.error('[MAIL ERROR]', err.message));

    return res.status(201).json({
      success: true,
      ref,
      message: 'Quote request received! We will contact you shortly.',
    });
  }
);

// ══════════════════════════════════════════════════════════════
// GET /api/quotes  (admin only)
// Returns all quotes with optional filters
// ══════════════════════════════════════════════════════════════
router.get('/', requireAdmin,
  [
    query('status').optional().isIn(['new','contacted','won','lost']),
    query('limit').optional().isInt({ min: 1, max: 200 }),
    query('offset').optional().isInt({ min: 0 }),
    query('search').optional().isLength({ max: 100 }),
  ],
  (req, res) => {
    const { status, search, limit = 50, offset = 0 } = req.query;

    let conditions = [];
    let params = [];

    if (status) { conditions.push("status = ?"); params.push(status); }
    if (search) {
      conditions.push("(name LIKE ? OR phone LIKE ? OR ref LIKE ?)");
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const rows = db.prepare(`SELECT * FROM quotes ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
                   .all(...params, parseInt(limit), parseInt(offset));

    const total = db.prepare(`SELECT COUNT(*) as c FROM quotes ${where}`).get(...params).c;
    const stats = {
      total:     db.prepare("SELECT COUNT(*) as c FROM quotes").get().c,
      new:       db.prepare("SELECT COUNT(*) as c FROM quotes WHERE status='new'").get().c,
      contacted: db.prepare("SELECT COUNT(*) as c FROM quotes WHERE status='contacted'").get().c,
      won:       db.prepare("SELECT COUNT(*) as c FROM quotes WHERE status='won'").get().c,
      lost:      db.prepare("SELECT COUNT(*) as c FROM quotes WHERE status='lost'").get().c,
    };

    res.json({ success: true, total, stats, quotes: rows });
  }
);

// ══════════════════════════════════════════════════════════════
// GET /api/quotes/:id  (admin only)
// Returns a single quote by ID
// ══════════════════════════════════════════════════════════════
router.get('/:id', requireAdmin, (req, res) => {
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Quote not found' });
  res.json({ success: true, quote });
});

// ══════════════════════════════════════════════════════════════
// PATCH /api/quotes/:id  (admin only)
// Update a quote's status
// ══════════════════════════════════════════════════════════════
router.patch('/:id', requireAdmin,
  [body('status').isIn(['new','contacted','won','lost']).withMessage('Invalid status')],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { status } = req.body;
    const result = db.prepare('UPDATE quotes SET status = ? WHERE id = ?').run(status, req.params.id);

    if (result.changes === 0) return res.status(404).json({ error: 'Quote not found' });

    log('update_quote', `id=${req.params.id} status=${status}`);
    res.json({ success: true });
  }
);

// ══════════════════════════════════════════════════════════════
// DELETE /api/quotes/:id  (admin only)
// ══════════════════════════════════════════════════════════════
router.delete('/:id', requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM quotes WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Quote not found' });
  log('delete_quote', `id=${req.params.id}`);
  res.json({ success: true });
});

module.exports = router;
