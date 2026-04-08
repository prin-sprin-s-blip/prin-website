// src/config/setup.js
// Run once after installing: node src/config/setup.js
// Creates all tables and inserts default pricing data.

require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/chrispine.db';
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── SCHEMA ─────────────────────────────────────────────────────
db.exec(`

  /* Stores every quote request submitted via the website */
  CREATE TABLE IF NOT EXISTS quotes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ref         TEXT    NOT NULL UNIQUE,
    name        TEXT    NOT NULL,
    phone       TEXT    NOT NULL,
    email       TEXT,
    size_m2     REAL,
    grass_type  TEXT,
    service     TEXT,
    message     TEXT,
    status      TEXT    NOT NULL DEFAULT 'new',
    ip_address  TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  /* Grass varieties and live pricing — editable via admin */
  CREATE TABLE IF NOT EXISTS grass_types (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    slug        TEXT    NOT NULL UNIQUE,
    name        TEXT    NOT NULL,
    price_m2    REAL    NOT NULL,
    description TEXT,
    badge       TEXT,
    active      INTEGER NOT NULL DEFAULT 1
  );

  /* Service options and flat rates */
  CREATE TABLE IF NOT EXISTS services (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    slug        TEXT    NOT NULL UNIQUE,
    name        TEXT    NOT NULL,
    flat_rate   REAL    NOT NULL DEFAULT 0,
    description TEXT,
    active      INTEGER NOT NULL DEFAULT 1
  );

  /* Admin activity log */
  CREATE TABLE IF NOT EXISTS activity_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    action      TEXT    NOT NULL,
    detail      TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  /* Auto-update updated_at on quotes */
  CREATE TRIGGER IF NOT EXISTS quotes_updated_at
    AFTER UPDATE ON quotes
    BEGIN
      UPDATE quotes SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

`);

// ── SEED DEFAULT DATA ──────────────────────────────────────────
const insertGrass = db.prepare(`
  INSERT OR IGNORE INTO grass_types (slug, name, price_m2, description, badge)
  VALUES (@slug, @name, @price_m2, @description, @badge)
`);

const insertService = db.prepare(`
  INSERT OR IGNORE INTO services (slug, name, flat_rate, description)
  VALUES (@slug, @name, @flat_rate, @description)
`);

const seed = db.transaction(() => {
  insertGrass.run({ slug:'kikuyu',   name:'Kikuyu',   price_m2:44.99,  description:'Hardy, fast-growing and drought-resistant. Ideal for high-traffic areas.',  badge:'Most Popular' });
  insertGrass.run({ slug:'buffalo',  name:'Buffalo',  price_m2:100.00, description:'Lush, thick and luxurious. Perfect for low-maintenance lawns.',             badge:'Premium' });
  insertGrass.run({ slug:'lm-berea', name:'LM Berea', price_m2:99.99,  description:'Fine-bladed and soft underfoot. Excellent for shaded gardens.',             badge:'Shade Loving' });

  insertService.run({ slug:'collection',   name:'Farm Collection',   flat_rate:0,    description:'Pick up grass directly from our farm.' });
  insertService.run({ slug:'delivery',     name:'Delivery',          flat_rate:350,  description:'We deliver fresh grass to your door.' });
  insertService.run({ slug:'installation', name:'Full Installation', flat_rate:1200, description:'We install the entire lawn for you.' });
});

seed();

console.log('✅  Database ready at:', DB_PATH);
console.log('    Tables : quotes, grass_types, services, activity_log');
console.log('    Grass  : Kikuyu, Buffalo, LM Berea');
console.log('    Services: Collection, Delivery, Installation');
db.close();
