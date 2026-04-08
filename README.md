# 🌿 Chrispine Landscaping — Complete Project

Full-stack website: redesigned frontend + Node.js/Express backend with SQLite database, email notifications, price calculator API, and admin dashboard.

---

## 📁 Project Structure

```
chrispine-v2/
├── public/
│   └── index.html              ← Your website (frontend)
├── src/
│   ├── server.js               ← Main Express server (start here)
│   ├── config/
│   │   ├── setup.js            ← Creates DB + seeds default data (run once)
│   │   ├── db.js               ← SQLite database connection
│   │   └── mailer.js           ← Email notifications (new quote alerts)
│   ├── middleware/
│   │   └── auth.js             ← Admin route protection
│   └── routes/
│       ├── quotes.js           ← Quote form API
│       ├── pricing.js          ← Grass prices + calculator API
│       └── admin.js            ← Admin dashboard (HTML)
├── .env.example                ← Copy to .env and fill in your details
├── package.json
└── Procfile                    ← For Railway/Render deployment
```

---

## 🚀 How to Run Locally

### Step 1 — Install Node.js
Download from https://nodejs.org (choose LTS). Verify:
```bash
node --version   # should be v18 or higher
npm --version
```

### Step 2 — Extract and install
```bash
tar -xzf chrispine-complete.tar.gz
cd chrispine-v2
npm install
```

### Step 3 — Configure environment
```bash
cp .env.example .env
```
Open `.env` and fill in:
| Variable | What to put |
|---|---|
| `PORT` | `3000` |
| `ADMIN_SECRET` | Any long password, e.g. `mySuperSecret123!` |
| `SMTP_USER` | Your Gmail address |
| `SMTP_PASS` | Gmail App Password (see below) |
| `NOTIFY_EMAIL` | Email where quote alerts go |

**Getting a Gmail App Password:**
1. Go to myaccount.google.com → Security → 2-Step Verification → App Passwords
2. Create one named "Chrispine Website"
3. Copy the 16-character code into `SMTP_PASS`

### Step 4 — Set up the database
```bash
node src/config/setup.js
```
This creates `data/chrispine.db` with all tables and default pricing.

### Step 5 — Start the server
```bash
npm run dev       # development (auto-restarts on changes)
npm start         # production
```

Open **http://localhost:3000** — your website is live!
Open **http://localhost:3000/admin?key=YOUR_ADMIN_SECRET** — admin dashboard.

---

## 🌐 Deploy to Railway (Free Hosting)

1. Push the project to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
# Create a repo on github.com then:
git remote add origin https://github.com/YOUR_USERNAME/chrispine-landscaping.git
git push -u origin main
```

2. Go to **railway.app** → New Project → Deploy from GitHub → select your repo

3. In Railway → **Variables**, add all the same variables from your `.env` file

4. In Railway's terminal/console, run the setup once:
```bash
node src/config/setup.js
```

5. Go to **Settings → Networking → Generate Domain** to get your free URL

---

## 📋 API Reference

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/quotes` | Submit quote from website form | Public |
| `GET` | `/api/quotes` | List all quotes | Admin |
| `PATCH` | `/api/quotes/:id` | Update quote status | Admin |
| `DELETE` | `/api/quotes/:id` | Delete a quote | Admin |
| `GET` | `/api/grass-types` | All grass types + prices | Public |
| `GET` | `/api/services` | All services + flat rates | Public |
| `GET` | `/api/calculate?size=80&grass=kikuyu&service=installation` | Price calculation | Public |
| `PATCH` | `/api/grass-types/:slug` | Update a grass price | Admin |
| `PATCH` | `/api/services/:slug` | Update a service rate | Admin |
| `GET` | `/admin?key=SECRET` | Admin dashboard (HTML) | Admin |
| `GET` | `/health` | Server health check | Public |

**Admin authentication:** Pass your `ADMIN_SECRET` as:
- Header: `X-Admin-Secret: yourpassword`
- Query param: `?key=yourpassword` (for browser access)

---

## 🛠️ Admin Dashboard Features

Visit `/admin?key=YOUR_SECRET` to:
- See stats: Total / New / Contacted / Won / Lost quotes
- Search and filter quotes by status or name/phone
- Update quote status with a dropdown (auto-saves)
- Update grass prices live (no redeploy needed)
- Update service flat rates live
- Delete quotes
- Click any phone number to open WhatsApp directly

---

## 💾 Database Tables

| Table | Purpose |
|---|---|
| `quotes` | Every quote request submitted via the website |
| `grass_types` | Grass varieties and pricing (editable via admin) |
| `services` | Service options and flat rates (editable via admin) |
| `activity_log` | Admin actions log |
