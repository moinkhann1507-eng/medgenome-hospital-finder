# MedGenome Hospital Finder — Deployment Guide

## 🚀 Quick Deploy Options

### Option 1: Railway (Recommended — Easiest)

Railway supports Node.js + SQLite out of the box with zero configuration.

**Steps:**
1. Push your code to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repository
4. Railway auto-detects Next.js and deploys
5. Add environment variable: `DATABASE_URL=file:./db/hospitals.db`
6. Your app is live at `xxx.up.railway.app`!

**Cost:** Free tier available ($5 credit/month)

---

### Option 2: Vercel (Free, but limited)

Vercel is the easiest for Next.js, but it uses **serverless functions** which means:
- SQLite won't persist (read-only filesystem)
- You need to switch to a cloud database (Supabase/PlanetScale)

**Steps with external DB:**
1. Create a **Supabase** account (free PostgreSQL)
2. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Push your code to GitHub
4. Go to [vercel.com](https://vercel.com) → Import Project
5. Add env var: `DATABASE_URL=postgresql://...` (from Supabase)
6. Deploy!

**Cost:** Free tier (100GB bandwidth)

---

### Option 3: Docker (VPS / Cloud)

For full control on any VPS (AWS EC2, DigitalOcean, Hetzner, etc.)

**Steps:**
1. Build the Docker image:
   ```bash
   docker build -t medgenome-hospital-finder .
   ```
2. Run the container:
   ```bash
   docker run -p 3000:3000 \
     -v $(pwd)/data:/app/data \
     -e DATABASE_URL=file:/app/data/hospitals.db \
     medgenome-hospital-finder
   ```
3. App runs at `http://your-server:3000`

**Cost:** VPS from $4/month (DigitalOcean/Hetzner)

---

### Option 4: Render (Simple & Affordable)

Similar to Railway with persistent disk support.

**Steps:**
1. Push to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your repo
4. Settings:
   - Build Command: `npm install && npx prisma generate && npm run build`
   - Start Command: `npx prisma db push && node .next/standalone/server.js`
5. Add persistent disk for SQLite database
6. Add env var: `DATABASE_URL=file:/opt/render/project/src/db/hospitals.db`

**Cost:** Free tier available (with limitations)

---

## 📦 Pre-Deployment Checklist

Before deploying, make sure:

1. **Database is populated** — Your SQLite DB has 30,273 hospitals
2. **Specialties file exists** — `/public/specialties.json` is generated
3. **No hardcoded paths** — DATABASE_URL uses relative path for production

## 🔧 Production Environment Variables

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | `file:./db/hospitals.db` | ✅ Yes |
| `NODE_ENV` | `production` | ✅ Yes |
| `PORT` | `3000` (or auto) | ❌ Auto |

## 🗄️ Switching to PostgreSQL (Recommended for Production)

SQLite is great for development but PostgreSQL is better for production:

1. Install pg client:
   ```bash
   npm install pg
   ```

2. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

3. Set `DATABASE_URL` to your PostgreSQL connection string

4. Run migration:
   ```bash
   npx prisma migrate dev --name init
   ```

5. Import data:
   ```bash
   node scripts/import-to-pg.js
   ```

## 🔒 Custom Domain Setup

After deployment, you can add a custom domain:
- **Railway**: Settings → Domains → Add Custom Domain
- **Vercel**: Settings → Domains → Add
- **Render**: Settings → Custom Domains
- **Docker**: Use nginx reverse proxy with Let's Encrypt

---

## 📊 Recommended Stack for Production

| Component | Development | Production |
|-----------|-------------|------------|
| Database | SQLite | PostgreSQL (Supabase) |
| Hosting | Local | Railway/Render |
| AI | Z-AI SDK | Z-AI SDK (same) |
| Map | OpenStreetMap | OpenStreetMap |
| CDN | — | Cloudflare (optional) |
