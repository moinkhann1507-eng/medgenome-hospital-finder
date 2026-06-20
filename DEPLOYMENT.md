# 🚀 MedGenome Hospital Finder — Step-by-Step Deployment Guide
## (No coding experience needed — just follow the clicks!)

---

# 📋 STEP 1: Create Supabase Account (Free Database)

> **What is Supabase?** It's a free online database where your 30,000 hospitals will be stored.

### 1.1 Open Supabase website
- Open your browser
- Go to: **https://supabase.com**
- Click the green **"Start your project"** button

### 1.2 Sign up
- Click **"Continue with GitHub"** (easiest option)
- If you don't have GitHub account, click "Sign up" first at https://github.com
- Authorize Supabase to use your GitHub

### 1.3 Create a new project
- You'll see a dashboard with a button **"New Project"**
- Click it
- Fill in:
  ```
  Project Name:  medgenome-hospitals
  Database Password:  [Pick any strong password — WRITE IT DOWN!]
  Region:  [Pick closest to India — e.g., "Southeast Asia (Singapore)"]
  ```
- Click **"Create new project"**
- ⏳ Wait 1-2 minutes while it sets up

### 1.4 Copy your Database URL (IMPORTANT!)
- On the left sidebar, click the **⚙️ Settings** icon
- Click **"Database"**
- Scroll down to **"Connection string"**
- Click the **"URI"** tab
- You'll see something like:
  ```
  postgresql://postgres.xxxxx:YOUR-PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
  ```
- Click the **copy icon** 📋 to copy it
- ⚠️ **Replace `YOUR-PASSWORD`** with the password you set in Step 1.3
- Save this URL — you'll need it in Steps 3 & 4!

✅ **Step 1 done!** You now have a free cloud database.

---

# 📋 STEP 2: Push Code to GitHub (Share Your Code Online)

> **What is GitHub?** It's like Google Drive for code. Vercel will read your code from here.

### 2.1 Create a GitHub account (if you don't have one)
- Go to: **https://github.com/signup**
- Fill in username, email, password
- Verify your email

### 2.2 Create a new repository
- Go to: **https://github.com/new**
- Fill in:
  ```
  Repository name:  medgenome-hospital-finder
  Visibility:  ✅ Private (recommended)
  ```
- ❌ Do NOT check "Add a README" or anything else
- Click **"Create repository"**
- Keep this page open — you'll need it

### 2.3 Push your code from terminal
- Open the terminal in your project
- Run these commands ONE BY ONE:

```bash
cd /home/z/my-project

# Tell git who you are (only first time)
git config --global user.email "your-email@example.com"
git config --global user.name "Your Name"

# Initialize git
git init

# Add all files
git add .

# Save the first version
git commit -m "MedGenome Hospital Finder"

# Connect to your GitHub repo (use YOUR username)
git remote add origin https://github.com/YOUR-USERNAME/medgenome-hospital-finder.git

# Push code to GitHub
git push -u origin main
```

- It will ask for your GitHub username and password
  - Username: your GitHub username
  - Password: use a **Personal Access Token** (not your GitHub password)
    - Go to: https://github.com/settings/tokens
    - Click **"Generate new token (classic)"**
    - Check the **"repo"** checkbox
    - Click **"Generate token"**
    - Copy the token — use this as your password

✅ **Step 2 done!** Your code is now on GitHub.

---

# 📋 STEP 3: Deploy to Vercel (Make It Live!)

> **What is Vercel?** It's a free hosting service that puts your website online.

### 3.1 Create a Vercel account
- Go to: **https://vercel.com/signup**
- Click **"Continue with GitHub"**
- Authorize Vercel to access your GitHub

### 3.2 Import your project
- You'll see your dashboard
- Click **"Add New..."** → **"Project"**
- You should see `medgenome-hospital-finder` in the list
- Click **"Import"** on that repository

### 3.3 Configure the deployment
- You'll see a settings page. Make sure:
  - **Framework Preset**: Next.js (should auto-detect)
  - **Build Command**: `npx prisma generate && next build`

### 3.4 Add the DATABASE_URL (CRITICAL!)
- On the same settings page, find **"Environment Variables"**
- Click **"Add"**
- Fill in:
  ```
  Name:   DATABASE_URL
  Value:  [Paste your Supabase URL from Step 1.4]
  ```
  Example:
  ```
  DATABASE_URL = postgresql://postgres.abcde:MyPass123@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
  ```
- Click **"Add"**

### 3.5 Deploy!
- Click the big blue **"Deploy"** button
- ⏳ Wait 2-3 minutes while it builds
- When it's done, you'll see: 🎉 **"Congratulations!"**
- Click **"Visit"** to see your live app!

> ⚠️ **The website will load but show no hospitals yet** — that's normal! We need Step 4.

✅ **Step 3 done!** Your website is live on the internet!

---

# 📋 STEP 4: Import Hospital Data (Fill the Database)

> **Your website is live but empty.** Let's add the 30,273 hospitals.

### 4.1 Switch to PostgreSQL schema
- In your terminal, run:

```bash
cd /home/z/my-project

# Switch database schema to PostgreSQL
node scripts/switch-db.js postgresql
npx prisma generate
```

### 4.2 Set your Supabase URL temporarily
```bash
# Replace with YOUR actual Supabase URL from Step 1.4
export DATABASE_URL="postgresql://postgres.xxxxx:YourPassword@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
```

### 4.3 Create database tables
```bash
npx prisma db push
```
- This creates the "Hospital" table in Supabase
- If it asks "Are you sure?", type `y` and press Enter

### 4.4 Import all 30,273 hospitals
```bash
node scripts/import-to-pg.js
```
- You'll see a progress bar:
  ```
  Loading hospital data...
  Loaded 30273 hospitals
  Importing hospitals to PostgreSQL...
    Progress: 30273/30273 (100.0%)
  ✅ Successfully imported 30273 hospitals!
  Database now has 30273 hospitals
  ```

### 4.5 Switch back to SQLite for local dev
```bash
node scripts/switch-db.js sqlite
npx prisma generate
```

✅ **Step 4 done!** Your live website now has all hospitals!

---

# 📋 STEP 5: Your App is LIVE! 🎉

### Visit your app:
- Go to your Vercel dashboard: **https://vercel.com/dashboard**
- Click on your project
- Click the URL (looks like: `medgenome-hospital-finder.vercel.app`)
- **Your app is now live for the whole world!** 🌍

### What works:
- ✅ 30,273 hospitals across India
- ✅ Interactive map with hospital markers
- ✅ AI Search (MedGenome AI)
- ✅ Web search for hospitals not in directory
- ✅ 2,806 specialties filter
- ✅ State, ownership, emergency filters
- ✅ Hospital details with directions

---

# 🔄 How to Update Your App Later

If you make changes to the code and want to update the live website:

```bash
cd /home/z/my-project
git add .
git commit -m "Updated feature XYZ"
git push
```

That's it! Vercel automatically detects the push and redeploys in ~2 minutes. No manual work needed.

---

# 🌐 Optional: Add Custom Domain (Free if you own one)

1. Go to Vercel → Your Project → **Settings** → **Domains**
2. Type your domain (e.g., `hospitals.medgenome.com`)
3. Vercel shows you DNS records to add
4. Add those records in your domain registrar (GoDaddy, Namecheap, etc.)
5. Done! Your app is now at your custom domain

---

# ❓ Common Problems & Fixes

| Problem | Fix |
|---------|-----|
| "Database connection error" on website | Check DATABASE_URL in Vercel Settings → Environment Variables |
| "No hospitals found" | Run Step 4 again (import data) |
| AI search returns "local" instead of AI | Normal sometimes — AI has timeouts, just try again |
| Map tiles not loading | OpenStreetMap is sometimes slow — refresh the page |
| Build fails on Vercel | Check Vercel logs → usually a missing env variable |
| "git push" asks for password | Use GitHub Personal Access Token, not your real password |

---

# 💰 Cost: $0/month Forever

| Service | What it costs |
|---------|---------------|
| Supabase | Free (500MB database, 2 projects) |
| Vercel | Free (100GB bandwidth, serverless) |
| GitHub | Free (private repos) |
| Z-AI SDK | Free (built-in) |
| OpenStreetMap | Free |
| **Total** | **$0** |
