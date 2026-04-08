// src/routes/admin.js
// Visual admin dashboard served at /admin
// Access: /admin?key=YOUR_ADMIN_SECRET

const express = require('express');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Pass the secret key through to all links/actions in the page
function withKey(req, path) {
  return `${path}?key=${encodeURIComponent(req.query.key || '')}`;
}

// ══════════════════════════════════════════════════════════════
// GET /admin  — main dashboard
// ══════════════════════════════════════════════════════════════
router.get('/', requireAdmin, (req, res) => {
  const stats = {
    total:     db.prepare("SELECT COUNT(*) as c FROM quotes").get().c,
    new:       db.prepare("SELECT COUNT(*) as c FROM quotes WHERE status='new'").get().c,
    contacted: db.prepare("SELECT COUNT(*) as c FROM quotes WHERE status='contacted'").get().c,
    won:       db.prepare("SELECT COUNT(*) as c FROM quotes WHERE status='won'").get().c,
    lost:      db.prepare("SELECT COUNT(*) as c FROM quotes WHERE status='lost'").get().c,
  };

  const filter = req.query.status || '';
  const search = req.query.search || '';

  let conditions = [];
  let params = [];
  if (filter) { conditions.push("status = ?"); params.push(filter); }
  if (search) {
    conditions.push("(name LIKE ? OR phone LIKE ? OR ref LIKE ?)");
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const quotes = db.prepare(`SELECT * FROM quotes ${where} ORDER BY created_at DESC LIMIT 100`).all(...params);

  const grassTypes = db.prepare('SELECT * FROM grass_types ORDER BY id').all();
  const services   = db.prepare('SELECT * FROM services ORDER BY flat_rate').all();
  const key        = req.query.key || '';

  const statusColors = { new:'#f59e0b', contacted:'#3b82f6', won:'#22c55e', lost:'#ef4444' };
  const statusBg     = { new:'#fef3c7', contacted:'#dbeafe', won:'#dcfce7', lost:'#fee2e2' };

  const quoteRows = quotes.map(q => `
    <tr data-id="${q.id}">
      <td><span class="ref">${q.ref}</span></td>
      <td><strong>${escHtml(q.name)}</strong></td>
      <td><a href="https://wa.me/${q.phone.replace(/\D/g,'')}" target="_blank" class="wa-link">${escHtml(q.phone)}</a></td>
      <td>${q.size_m2 ? q.size_m2 + ' m²' : '—'}</td>
      <td>${escHtml(q.grass_type || '—')}</td>
      <td>${escHtml(q.service || '—')}</td>
      <td>
        <select class="status-select" onchange="updateStatus(${q.id}, this.value)"
          style="background:${statusBg[q.status]};color:${statusColors[q.status]};border:1.5px solid ${statusColors[q.status]};">
          <option value="new"       ${q.status==='new'       ?'selected':''}>New</option>
          <option value="contacted" ${q.status==='contacted' ?'selected':''}>Contacted</option>
          <option value="won"       ${q.status==='won'       ?'selected':''}>Won</option>
          <option value="lost"      ${q.status==='lost'      ?'selected':''}>Lost</option>
        </select>
      </td>
      <td class="date-cell">${q.created_at.slice(0,16).replace('T',' ')}</td>
      <td>
        <button class="del-btn" onclick="deleteQuote(${q.id}, this)" title="Delete">🗑</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="9" class="empty">No quotes yet.</td></tr>`;

  const grassRows = grassTypes.map(g => `
    <tr>
      <td><strong>${escHtml(g.name)}</strong></td>
      <td>${escHtml(g.badge || '—')}</td>
      <td>
        <div class="price-edit">
          <span>R</span>
          <input type="number" value="${g.price_m2}" step="0.01" min="0"
                 id="price-${g.slug}" style="width:90px;">
          <button onclick="updatePrice('${g.slug}', document.getElementById('price-${g.slug}').value)">Save</button>
        </div>
      </td>
      <td><span class="active-badge ${g.active ? 'yes' : 'no'}">${g.active ? 'Active' : 'Hidden'}</span></td>
    </tr>
  `).join('');

  const serviceRows = services.map(s => `
    <tr>
      <td><strong>${escHtml(s.name)}</strong></td>
      <td>${escHtml(s.description || '—')}</td>
      <td>
        <div class="price-edit">
          <span>R</span>
          <input type="number" value="${s.flat_rate}" step="1" min="0"
                 id="svc-${s.slug}" style="width:90px;">
          <button onclick="updateServiceRate('${s.slug}', document.getElementById('svc-${s.slug}').value)">Save</button>
        </div>
      </td>
    </tr>
  `).join('');

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Admin — Chrispine Landscaping</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', sans-serif; background: #f0f4f1; color: #1a2e1d; font-size: 14px; }

    /* ── TOPBAR ── */
    .topbar {
      background: #1b6b2f; color: white;
      padding: 0 32px; height: 58px;
      display: flex; align-items: center; justify-content: space-between;
      position: sticky; top: 0; z-index: 100;
      box-shadow: 0 2px 12px rgba(0,0,0,.15);
    }
    .topbar h1 { font-size: 1rem; font-weight: 600; display: flex; align-items: center; gap: 8px; }
    .topbar a  { color: rgba(255,255,255,.7); text-decoration: none; font-size: .85rem; }
    .topbar a:hover { color: white; }

    /* ── LAYOUT ── */
    .page { max-width: 1400px; margin: 0 auto; padding: 28px 24px 60px; }

    /* ── STAT CARDS ── */
    .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 28px; }
    .stat-card {
      background: white; border-radius: 12px; padding: 18px 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,.06);
    }
    .stat-card .num { font-size: 2rem; font-weight: 700; line-height: 1; }
    .stat-card .lbl { font-size: .75rem; color: #6b7c6e; text-transform: uppercase; letter-spacing: .07em; margin-top: 4px; }
    .stat-card.total .num { color: #1b6b2f; }
    .stat-card.snew  .num { color: #f59e0b; }
    .stat-card.scon  .num { color: #3b82f6; }
    .stat-card.swon  .num { color: #22c55e; }
    .stat-card.slost .num { color: #ef4444; }

    /* ── CARD ── */
    .card {
      background: white; border-radius: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,.06);
      margin-bottom: 28px; overflow: hidden;
    }
    .card-header {
      padding: 18px 24px; border-bottom: 1px solid #f0f0f0;
      display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
    }
    .card-header h2 { font-size: 1rem; font-weight: 600; }

    /* ── FILTER BAR ── */
    .filters { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .filters form { display: flex; gap: 8px; flex-wrap: wrap; }
    .filters input[type=text] {
      padding: 8px 14px; border: 1.5px solid #e0e0e0; border-radius: 8px;
      font-family: inherit; font-size: .85rem; outline: none;
    }
    .filters input[type=text]:focus { border-color: #1b6b2f; }
    .filter-btn {
      padding: 8px 16px; border-radius: 8px; border: 1.5px solid #e0e0e0;
      font-family: inherit; font-size: .82rem; cursor: pointer;
      background: white; transition: all .2s;
    }
    .filter-btn:hover, .filter-btn.active { background: #1b6b2f; color: white; border-color: #1b6b2f; }

    /* ── TABLE ── */
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th {
      background: #f8faf8; padding: 12px 16px; text-align: left;
      font-size: .75rem; font-weight: 600; letter-spacing: .07em; text-transform: uppercase;
      color: #6b7c6e; white-space: nowrap;
    }
    td { padding: 12px 16px; border-top: 1px solid #f5f5f5; vertical-align: middle; }
    tr:hover td { background: #fafcfa; }
    .ref { font-family: monospace; font-size: .82rem; background: #f0f4f1; padding: 3px 8px; border-radius: 5px; }
    .wa-link { color: #1b6b2f; text-decoration: none; font-weight: 500; }
    .wa-link:hover { text-decoration: underline; }
    .date-cell { color: #999; font-size: .82rem; white-space: nowrap; }
    .empty { text-align: center; padding: 40px !important; color: #999; }

    /* ── STATUS SELECT ── */
    .status-select {
      padding: 5px 10px; border-radius: 20px; font-family: inherit;
      font-size: .78rem; font-weight: 600; cursor: pointer; outline: none;
    }

    /* ── DELETE BUTTON ── */
    .del-btn {
      background: none; border: none; cursor: pointer; font-size: 1rem;
      opacity: .4; transition: opacity .2s;
    }
    .del-btn:hover { opacity: 1; }

    /* ── PRICING TABLE ── */
    .price-edit { display: flex; align-items: center; gap: 6px; }
    .price-edit span { color: #666; font-weight: 600; }
    .price-edit input {
      padding: 6px 10px; border: 1.5px solid #e0e0e0; border-radius: 6px;
      font-family: inherit; font-size: .9rem; outline: none;
    }
    .price-edit input:focus { border-color: #1b6b2f; }
    .price-edit button {
      padding: 6px 14px; background: #1b6b2f; color: white;
      border: none; border-radius: 6px; font-family: inherit;
      font-size: .82rem; cursor: pointer; transition: background .2s;
    }
    .price-edit button:hover { background: #0f3d1a; }
    .active-badge { padding: 3px 10px; border-radius: 20px; font-size: .75rem; font-weight: 600; }
    .active-badge.yes { background: #dcfce7; color: #166534; }
    .active-badge.no  { background: #f3f4f6; color: #9ca3af; }

    /* ── TOAST ── */
    #toast {
      position: fixed; bottom: 28px; right: 28px; z-index: 999;
      background: #1b6b2f; color: white; padding: 12px 22px;
      border-radius: 10px; font-size: .9rem; font-weight: 500;
      box-shadow: 0 4px 20px rgba(0,0,0,.2);
      transform: translateY(80px); opacity: 0;
      transition: all .3s cubic-bezier(.23,1,.32,1);
      pointer-events: none;
    }
    #toast.show { transform: translateY(0); opacity: 1; }

    @media(max-width:900px) {
      .stats { grid-template-columns: repeat(3,1fr); }
      .page { padding: 16px 12px 40px; }
    }
  </style>
</head>
<body>

<div class="topbar">
  <h1>🌿 Chrispine Landscaping &nbsp;·&nbsp; Admin</h1>
  <a href="/" target="_blank">← View Website</a>
</div>

<div class="page">

  <!-- STATS -->
  <div class="stats">
    <div class="stat-card total"><div class="num">${stats.total}</div><div class="lbl">Total Quotes</div></div>
    <div class="stat-card snew"> <div class="num">${stats.new}</div>  <div class="lbl">New</div></div>
    <div class="stat-card scon"> <div class="num">${stats.contacted}</div><div class="lbl">Contacted</div></div>
    <div class="stat-card swon"> <div class="num">${stats.won}</div>  <div class="lbl">Won</div></div>
    <div class="stat-card slost"><div class="num">${stats.lost}</div> <div class="lbl">Lost</div></div>
  </div>

  <!-- QUOTES TABLE -->
  <div class="card">
    <div class="card-header">
      <h2>📋 Quote Requests</h2>
      <div class="filters">
        <form method="GET" style="display:flex;gap:8px;align-items:center;">
          <input type="hidden" name="key" value="${escHtml(key)}">
          <input type="text" name="search" value="${escHtml(search)}" placeholder="Search name / phone / ref…">
          <button type="submit" class="filter-btn">Search</button>
        </form>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <a href="?key=${encodeURIComponent(key)}" class="filter-btn ${!filter ? 'active' : ''}">All</a>
          <a href="?key=${encodeURIComponent(key)}&status=new"       class="filter-btn ${filter==='new'       ?'active':''}">New</a>
          <a href="?key=${encodeURIComponent(key)}&status=contacted" class="filter-btn ${filter==='contacted' ?'active':''}">Contacted</a>
          <a href="?key=${encodeURIComponent(key)}&status=won"       class="filter-btn ${filter==='won'       ?'active':''}">Won</a>
          <a href="?key=${encodeURIComponent(key)}&status=lost"      class="filter-btn ${filter==='lost'      ?'active':''}">Lost</a>
        </div>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Ref</th><th>Name</th><th>Phone</th><th>Size</th>
            <th>Grass</th><th>Service</th><th>Status</th><th>Date</th><th></th>
          </tr>
        </thead>
        <tbody id="quotes-tbody">${quoteRows}</tbody>
      </table>
    </div>
  </div>

  <!-- GRASS PRICING -->
  <div class="card">
    <div class="card-header"><h2>🌿 Grass Pricing</h2></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Type</th><th>Badge</th><th>Price per m²</th><th>Status</th></tr></thead>
        <tbody>${grassRows}</tbody>
      </table>
    </div>
  </div>

  <!-- SERVICE RATES -->
  <div class="card">
    <div class="card-header"><h2>🚚 Service Rates</h2></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Service</th><th>Description</th><th>Flat Rate</th></tr></thead>
        <tbody>${serviceRows}</tbody>
      </table>
    </div>
  </div>

</div>

<div id="toast"></div>

<script>
const ADMIN_KEY = ${JSON.stringify(key)};

function toast(msg, ok = true) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.background = ok ? '#1b6b2f' : '#dc2626';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

async function updateStatus(id, status) {
  try {
    const r = await fetch('/api/quotes/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': ADMIN_KEY },
      body: JSON.stringify({ status }),
    });
    if (r.ok) toast('Status updated ✓');
    else toast('Failed to update', false);
  } catch { toast('Network error', false); }
}

async function deleteQuote(id, btn) {
  if (!confirm('Delete this quote permanently?')) return;
  try {
    const r = await fetch('/api/quotes/' + id, {
      method: 'DELETE',
      headers: { 'X-Admin-Secret': ADMIN_KEY },
    });
    if (r.ok) {
      btn.closest('tr').remove();
      toast('Quote deleted');
    } else toast('Failed to delete', false);
  } catch { toast('Network error', false); }
}

async function updatePrice(slug, value) {
  try {
    const r = await fetch('/api/grass-types/' + slug, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': ADMIN_KEY },
      body: JSON.stringify({ price_m2: parseFloat(value) }),
    });
    if (r.ok) toast('Price updated ✓');
    else toast('Failed to update', false);
  } catch { toast('Network error', false); }
}

async function updateServiceRate(slug, value) {
  try {
    const r = await fetch('/api/services/' + slug, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': ADMIN_KEY },
      body: JSON.stringify({ flat_rate: parseFloat(value) }),
    });
    if (r.ok) toast('Rate updated ✓');
    else toast('Failed to update', false);
  } catch { toast('Network error', false); }
}
</script>
</body>
</html>`);
});

// HTML escape helper (server-side only)
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = router;
