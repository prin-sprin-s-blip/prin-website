// src/middleware/auth.js

/**
 * Protects admin routes.
 * Accepts the secret via:
 *   - Header: X-Admin-Secret: yourpassword
 *   - Query:  ?key=yourpassword   (for browser access to /admin dashboard)
 */
function requireAdmin(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    console.warn('[AUTH] ADMIN_SECRET is not set in .env — admin routes are disabled.');
    return res.status(503).json({ error: 'Admin not configured.' });
  }

  const provided = req.headers['x-admin-secret'] || req.query.key;

  if (!provided || provided !== secret) {
    // If it looks like a browser request (wants HTML), give a nicer response
    if (req.accepts('html')) {
      return res.status(401).send(`
        <html><body style="font-family:sans-serif;display:grid;place-items:center;height:100vh;background:#f4f6f4;">
          <div style="text-align:center;">
            <h2>🔒 Admin Access</h2>
            <p>Add <code>?key=YOUR_ADMIN_SECRET</code> to the URL.</p>
          </div>
        </body></html>
      `);
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

module.exports = { requireAdmin };
