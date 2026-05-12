# TalentLens — One-Click Deploy Setup Guide
## Do this ONCE. After that: drag files + one click = live.

---

## PART 1 — Install Two Free Apps (one time)

### 1A. GitHub Desktop
→ https://desktop.github.com
Download and install. Create a free GitHub account if you don't have one.

### 1B. Railway Account
→ https://railway.app
Sign up with your GitHub account (important — use GitHub login).

---

## PART 2 — Create Your GitHub Repository (one time)

1. Open **GitHub Desktop**
2. Click **File → New Repository**
3. Name it: `talentlens`
4. Choose a local folder (e.g. `C:\Projects\talentlens`)
5. Click **Create Repository**
6. Copy all TalentLens files into that folder
7. In GitHub Desktop: click **"Publish repository"** (top bar)
8. Uncheck "Keep this code private" if you want, click **Publish**

Your code is now on GitHub. ✓

---

## PART 3 — Set Up Railway (one time, ~15 minutes)

### Step 1 — Create a new project
1. Go to https://railway.app/dashboard
2. Click **New Project**
3. Choose **Deploy from GitHub repo**
4. Select your `talentlens` repo

### Step 2 — Add PostgreSQL database
1. Inside your project, click **+ New**
2. Choose **Database → PostgreSQL**
3. Railway creates the DB instantly and sets `DATABASE_URL` automatically ✓

### Step 3 — Configure the Backend service
1. Click on your service (it may say "talentlens" or "backend")
2. Go to **Settings → Source** → set Root Directory to: `backend`
3. Go to **Variables** tab → Add these:

| Variable | Value |
|---|---|
| `SECRET_KEY` | (any long random text, e.g. `MyTalentLens2024SecureKey!`) |
| `ANTHROPIC_API_KEY` | Your key from https://console.anthropic.com |
| `ENVIRONMENT` | `production` |

4. Go to **Settings → Networking** → click **Generate Domain**
   - Copy the URL it gives you, e.g. `talentlens-backend-xxxx.railway.app`
   - You'll need this in Step 4

### Step 4 — Add the Frontend service
1. Click **+ New → GitHub Repo** again → same `talentlens` repo
2. Go to **Settings → Source** → set Root Directory to: `frontend`
3. Go to **Variables** tab → Add:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://talentlens-backend-xxxx.railway.app` (from Step 3) |

4. Go to **Settings → Networking** → click **Generate Domain**
   - This is your app URL right now (e.g. `talentlens-frontend-xxxx.railway.app`)

### Step 5 — Connect your custom domain
1. On the **Frontend service → Settings → Networking**
2. Click **+ Custom Domain**
3. Type your domain (e.g. `hire.yourcompany.com` or `talentlens.yourcompany.com`)
4. Railway shows you a CNAME record to add

**At your domain provider (GoDaddy / Cloudflare / Namecheap etc.):**
1. Go to DNS settings
2. Add a new CNAME record:
   - Name/Host: `hire` (or whatever subdomain you chose)
   - Value: the CNAME Railway gave you
   - TTL: Auto
3. Save. DNS takes 5–30 minutes to propagate.

Railway handles SSL/HTTPS automatically. ✓

---

## PART 4 — Your One-Click Deploy Workflow (every time after)

```
1. Get updated ZIP from Claude chat
2. Extract ZIP → copy files into your C:\Projects\talentlens folder (overwrite)
3. Open GitHub Desktop
4. You'll see the changed files listed automatically
5. Type a short message in the box (e.g. "UI update")
6. Click "Commit to main"
7. Click "Push origin"  ← THIS IS YOUR ONE CLICK
```

Railway detects the push → rebuilds → live in ~3 minutes. ✓

---

## PART 5 — Admin Login (first time on live site)

URL: `https://hire.yourcompany.com/admin/login`

```
Email:    admin@talentlens.io
Password: Admin@123
```

**Change the password immediately** in User Management after first login.

---

## Costs

| Service | Cost |
|---|---|
| Railway (backend + frontend) | ~$10–15/month |
| Railway PostgreSQL | Included in above |
| Domain name | $10–15/year (if you don't have one) |
| SSL certificate | Free (Railway handles it) |

---

## Need Help?

Tell Claude:
- "I'm stuck on Part 3 Step 4"
- "The CNAME isn't working"
- "Railway is showing an error: [paste error]"

Claude will guide you through it.
