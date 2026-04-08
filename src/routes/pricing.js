// src/routes/pricing.js
const express = require('express');
const { query, body, validationResult } = require('express-validator');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ══════════════════════════════════════════════════════════════
// GET /api/grass-types
// Returns all active grass varieties with prices
// Called by the frontend to keep prices in sync with DB
// ══════════════════════════════════════════════════════════════
router.get('/grass-types', (req, res) => {
  const types = db.prepare('SELECT * FROM grass_types WHERE active = 1 ORDER BY id').all();
  res.json({ success: true, data: types });
});

// ══════════════════════════════════════════════════════════════
// GET /api/services
// Returns all active service options with flat rates
// ══════════════════════════════════════════════════════════════
router.get('/services', (req, res) => {
  const services = db.prepare('SELECT * FROM services WHERE active = 1 ORDER BY flat_rate').all();
  res.json({ success: true, data: services });
});

// ══════════════════════════════════════════════════════════════
// GET /api/calculate?size=80&grass=kikuyu&service=installation
// Server-side price calculation — matches the frontend calculator
// ══════════════════════════════════════════════════════════════
router.get('/calculate',
  [
    query('size').notEmpty().isFloat({ min: 0.1, max: 999999 }).withMessage('size must be a positive number'),
    query('grass').notEmpty().withMessage('grass slug is required'),
    query('service').optional(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { size, grass, service } = req.query;

    const grassRow = db.prepare('SELECT * FROM grass_types WHERE slug = ? AND active = 1').get(grass);
    if (!grassRow) return res.status(400).json({ success: false, error: 'Unknown grass type' });

    const serviceRow = service
      ? db.prepare('SELECT * FROM services WHERE slug = ? AND active = 1').get(service)
      : null;

    if (service && !serviceRow) {
      return res.status(400).json({ success: false, error: 'Unknown service type' });
    }

    const grassCost   = parseFloat(size) * grassRow.price_m2;
    const serviceCost = serviceRow ? serviceRow.flat_rate : 0;
    const total       = grassCost + serviceCost;

    res.json({
      success: true,
      breakdown: {
        size_m2:  parseFloat(size),
        grass:    { name: grassRow.name,   price_per_m2: grassRow.price_m2, subtotal: +grassCost.toFixed(2) },
        service:  { name: serviceRow?.name || 'None', flat_rate: serviceCost },
        total:    +total.toFixed(2),
        currency: 'ZAR',
      },
    });
  }
);

// ══════════════════════════════════════════════════════════════
// PATCH /api/grass-types/:slug  (admin only)
// Update a grass price live without redeploying
// ══════════════════════════════════════════════════════════════
router.patch('/grass-types/:slug', requireAdmin,
  [body('price_m2').isFloat({ min: 0 }).withMessage('Price must be a positive number')],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const result = db.prepare('UPDATE grass_types SET price_m2 = ? WHERE slug = ?')
                     .run(req.body.price_m2, req.params.slug);

    if (result.changes === 0) return res.status(404).json({ error: 'Grass type not found' });
    res.json({ success: true, message: `Price updated for ${req.params.slug}` });
  }
);

// ══════════════════════════════════════════════════════════════
// PATCH /api/services/:slug  (admin only)
// Update a service flat rate live
// ══════════════════════════════════════════════════════════════
router.patch('/services/:slug', requireAdmin,
  [body('flat_rate').isFloat({ min: 0 }).withMessage('Flat rate must be 0 or more')],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const result = db.prepare('UPDATE services SET flat_rate = ? WHERE slug = ?')
                     .run(req.body.flat_rate, req.params.slug);

    if (result.changes === 0) return res.status(404).json({ error: 'Service not found' });
    res.json({ success: true, message: `Flat rate updated for ${req.params.slug}` });
  }
);

module.exports = router;
