# 🚀 MedGenome Hospital Finder — Free Deployment Guide
## Vercel + Supabase (100% Free, No Credit Card Required)

---

## Step 1: Create a Supabase Account & Database (5 min)

1. Go to **https://supabase.com** → Click **"Start your project"**
2. Sign up with **GitHub** (easiest)
3. Click **"New Project"**
4. Fill in:
   - **Name**: `medgenome-hospitals`
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Pick closest to India (e.g., Singapore or Mumbai)
5. Click **"Create new project"** → Wait ~2 min for setup

### Get your Database URL:
1. Go to **Settings** → **Database** (left sidebar)
2. Scroll to **"Connection string"** → Select **"URI"** tab
3. Copy the **Connection pooling** URL (port 6543)
4. Replace `[YOUR-PASSWORD]` with the password you set
5. It should look like:
   ```
   postgresql://postgres.abcdefghij:YourPassword@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
   ```

---

## Step 2: Push Code to GitHub (2 min)

1. Create a new repository on **https://github.com/new**
   - Name: `medgenome-hospital-finder`
   - **Private** (recommended)
2. Push your code:
   ```bash
   cd /home/z/my-project
   
   # Initialize git (if not already)
   git init
   git add .
   git commit -m "MedGenome Hospital Finder - Initial commit"
   
   # Push to GitHub
   git remote add origin https://github.com/YOUR-USERNAME/medgenome-hospital-finder.git
   git push -u origin main
   ```

---

## Step 3: Deploy to Vercel (3 min)

1. Go to **https://vercel.com** → Sign up with **GitHub**
2. Click **"Add New"** → **"Project"**
3. Select your `medgenome-hospital-finder` repository
4. Configure:
   - **Framework Preset**: Next.js (auto-detected)
   - **Build Command**: `npx prisma generate && next build`
   - **Output Directory**: (leave default)
5. Add **Environment Variable**:
   - **Name**: `DATABASE_URL`
   - **Value**: Your Supabase connection string from Step 1
6. Click **"Deploy"** → Wait ~2 min

---

## Step 4: Import Hospital Data to Supabase (5 min)

After Vercel deploys, the database is empty. You need to import the 30,273 hospitals:

### Option A: From your local machine
```bash
# Set your Supabase DATABASE_URL temporarily
export DATABASE_URL="postgresql://postgres.abcdefghij:YourPassword@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"

cd /home/z/my-project

# Create the database schema
npx prisma db push

# Import the hospital data
node scripts/import-to-pg.js
```

### Option B: From Supabase Dashboard (if Option A doesn't work)
1. Go to Supabase → SQL Editor
2. Run the schema from `prisma/schema.prisma`
3. Use the Table Editor to upload CSV data

---

## Step 5: Your App is Live! 🎉

Vercel gives you a URL like: **`medgenome-hospital-finder.vercel.app`**

### Custom Domain (Optional, Free):
1. Go to Vercel → Settings → Domains
2. Add your domain (e.g., `hospitals.medgenome.com`)
3. Update DNS records as shown

---

## 💰 Cost Summary: $0/month

| Service | Free Tier | Is it enough? |
|---------|-----------|---------------|
| **Vercel** | 100GB bandwidth, serverless functions | ✅ Yes (handles thousands of users) |
| **Supabase** | 500MB database, 2 projects | ✅ Yes (30K hospitals = ~50MB) |
| **Z-AI SDK** | Free, built-in | ✅ Yes |
| **OpenStreetMap** | Free | ✅ Yes |
| **GitHub** | Free for private repos | ✅ Yes |

---

## 🔧 Troubleshooting

### "AI search not working"
- Z-AI SDK works automatically in Vercel (no config needed)
- If it returns "local" source, the AI had a timeout — try again

### "Database connection error"
- Make sure `DATABASE_URL` is set in Vercel Environment Variables
- Use the **pooler** connection string (port 6543), not the direct one

### "Map not loading"
- OpenStreetMap tiles are free but sometimes slow
- No action needed — it's the map provider, not your app

### "App seems slow on first visit"
- Vercel serverless has cold starts (~1-2s)
- After first visit, it's fast for all subsequent requests

---

## 📱 Future Upgrades (Still Free)

- **Custom domain** → Point your domain to Vercel
- **Analytics** → Add Vercel Analytics (free)
- **Rate limiting** → Add Vercel KV (free tier)
- **User accounts** → Add NextAuth with Supabase auth (free)
