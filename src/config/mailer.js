// src/config/mailer.js
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

// ── Owner notification when a new quote arrives ───────────────
async function notifyNewQuote(quote) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('[MAIL] No SMTP credentials configured — skipping email.');
    return;
  }

  const to = process.env.NOTIFY_EMAIL || process.env.SMTP_USER;

  await getTransporter().sendMail({
    from: `"Chrispine Website" <${process.env.SMTP_USER}>`,
    to,
    subject: `🌿 New Quote [${quote.ref}] — ${quote.name}`,
    html: `
      <div style="font-family:'Segoe UI',sans-serif;max-width:580px;margin:auto;border-radius:12px;overflow:hidden;border:1px solid #e0e0e0;">
        
        <!-- Header -->
        <div style="background:#1b6b2f;padding:28px 32px;">
          <h2 style="color:white;margin:0;font-size:1.3rem;">🌿 New Quote Request</h2>
          <p style="color:rgba(255,255,255,.65);margin:6px 0 0;font-size:.9rem;">Ref: <strong style="color:white">${quote.ref}</strong> · ${quote.created_at}</p>
        </div>

        <!-- Body -->
        <div style="padding:28px 32px;background:#ffffff;">
          <table style="width:100%;border-collapse:collapse;font-size:.93rem;">
            <tr>
              <td style="padding:10px 0;color:#666;width:130px;vertical-align:top;">Name</td>
              <td style="padding:10px 0;font-weight:600;color:#111;">${quote.name}</td>
            </tr>
            <tr style="border-top:1px solid #f0f0f0;">
              <td style="padding:10px 0;color:#666;vertical-align:top;">Phone</td>
              <td style="padding:10px 0;font-weight:600;color:#111;">${quote.phone}</td>
            </tr>
            ${quote.email ? `
            <tr style="border-top:1px solid #f0f0f0;">
              <td style="padding:10px 0;color:#666;vertical-align:top;">Email</td>
              <td style="padding:10px 0;color:#111;">${quote.email}</td>
            </tr>` : ''}
            <tr style="border-top:1px solid #f0f0f0;">
              <td style="padding:10px 0;color:#666;vertical-align:top;">Lawn Size</td>
              <td style="padding:10px 0;color:#111;">${quote.size_m2 ? quote.size_m2 + ' m²' : 'Not specified'}</td>
            </tr>
            <tr style="border-top:1px solid #f0f0f0;">
              <td style="padding:10px 0;color:#666;vertical-align:top;">Grass Type</td>
              <td style="padding:10px 0;color:#111;">${quote.grass_type || 'Not specified'}</td>
            </tr>
            <tr style="border-top:1px solid #f0f0f0;">
              <td style="padding:10px 0;color:#666;vertical-align:top;">Service</td>
              <td style="padding:10px 0;color:#111;">${quote.service || 'Not specified'}</td>
            </tr>
            ${quote.message ? `
            <tr style="border-top:1px solid #f0f0f0;">
              <td style="padding:10px 0;color:#666;vertical-align:top;">Message</td>
              <td style="padding:10px 0;color:#111;font-style:italic;">"${quote.message}"</td>
            </tr>` : ''}
          </table>

          <!-- CTA -->
          <div style="margin-top:28px;display:flex;gap:12px;flex-wrap:wrap;">
            <a href="https://wa.me/${quote.phone.replace(/\D/g,'')}"
               style="background:#25D366;color:white;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:.9rem;display:inline-block;">
              💬 Reply on WhatsApp
            </a>
            ${quote.email ? `
            <a href="mailto:${quote.email}"
               style="background:#1b6b2f;color:white;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:.9rem;display:inline-block;">
              ✉️ Send Email
            </a>` : ''}
          </div>
        </div>

        <!-- Footer -->
        <div style="padding:16px 32px;background:#f5f5f5;font-size:.8rem;color:#999;text-align:center;">
          Chrispine Landscaping · Cape Town · This is an automated notification
        </div>
      </div>
    `,
  });

  console.log(`[MAIL] Quote notification sent to ${to} for ${quote.ref}`);
}

// ── Confirmation email to the customer ───────────────────────
async function confirmToCustomer(quote) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !quote.email) return;

  await getTransporter().sendMail({
    from: `"Chrispine Landscaping" <${process.env.SMTP_USER}>`,
    to: quote.email,
    subject: `Your quote request is received — ${quote.ref}`,
    html: `
      <div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:auto;">
        <div style="background:#1b6b2f;padding:28px 32px;border-radius:12px 12px 0 0;">
          <h2 style="color:white;margin:0;">🌿 Thanks, ${quote.name.split(' ')[0]}!</h2>
        </div>
        <div style="padding:28px 32px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 12px 12px;">
          <p style="color:#333;line-height:1.7;">We've received your quote request (ref: <strong>${quote.ref}</strong>) and will get back to you shortly on WhatsApp or by email.</p>
          <p style="color:#333;line-height:1.7;margin-top:12px;">In the meantime, feel free to message us directly:</p>
          <a href="https://wa.me/27601784928"
             style="background:#25D366;color:white;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:.9rem;display:inline-block;margin-top:16px;">
            💬 Chat on WhatsApp
          </a>
          <p style="color:#999;font-size:.82rem;margin-top:28px;">© 2026 Chrispine Landscaping · Cape Town</p>
        </div>
      </div>
    `,
  });
  console.log(`[MAIL] Confirmation sent to ${quote.email}`);
}

module.exports = { notifyNewQuote, confirmToCustomer };
