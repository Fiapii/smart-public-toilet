# GitHub to Railway Auto-Deployment Setup

Complete one-time setup to enable automatic deployment every time you push to GitHub.

---

## ⚡ Quick Setup (5 minutes)

### Step 1: Prepare Local Repository

**Windows:**
```bash
cd c:\NEW_PROJECT_CODES\smart-public-toilet
.\setup-github.bat
```

**Mac/Linux:**
```bash
cd /path/to/smart-public-toilet
chmod +x setup-github.sh
./setup-github.sh
```

This will:
- ✅ Initialize Git
- ✅ Create `.gitignore`
- ✅ Add GitHub remote
- ✅ Make initial commit

### Step 2: Create GitHub Repository

1. Go to: https://github.com/new
2. **Repository name:** `smart-public-toilet`
3. **Visibility:** Public
4. **Initialize:** Leave empty (DO NOT check any boxes)
5. Click **"Create repository"**

### Step 3: Push to GitHub

```bash
git push -u origin main
```

Wait for push to complete. You should see:
```
✅ Everything up-to-date
✓ Your branch is up to date with 'origin/main'
```

### Step 4: Connect Railway to GitHub

1. Go to: https://railway.app/dashboard
2. Click **"+ New Project"**
3. Select **"Deploy from GitHub"**
4. Find your `smart-public-toilet` repository
5. Click **"Deploy"**
6. ⏳ Wait for deployment (2-3 minutes)

### Step 5: Add Database & Config

1. In Railway dashboard, click **"+ Add Service"**
2. Select **"PostgreSQL"**
3. Click **"Create New"**
4. Go to **"Variables"** tab
5. Add your environment variables (from `.env.example`)
6. Deploy!

---

## 🎉 Done! Now What?

Every time you want to update:

```bash
# Make changes to your code
nano esp32_door_control.ino
# or edit in VS Code, etc.

# Commit and push
git add .
git commit -m "Description of changes"
git push
```

**That's it!** Railway automatically detects the push and redeploys within seconds. ✨

---

## 📊 What Gets Auto-Deployed

When you push to GitHub:

```
Your Computer                      GitHub                        Railway
    ↓                              ↓                              ↓
git push ────────────────→ Repository Updated ─────────→ Auto-Deploy Triggered
                                                              ↓
                                                         1. Pull latest code
                                                         2. Install dependencies
                                                         3. Run migrations
                                                         4. Start server
                                                         5. ✅ Live!
```

Takes ~30-60 seconds from push to live.

---

## 🔍 Monitor Deployment

### View Logs
In Railway dashboard:
- Click your project
- Go to **"Logs"** tab
- See deployment progress in real-time

### View Metrics
- Go to **"Metrics"** tab
- CPU, Memory, Requests, Response time

### Check if Live
```bash
curl https://YOUR_RAILWAY_APP.up.railway.app/health
```

Should return: `{"status":"ok"}`

---

## 🔑 Environment Variables

Your `.env` file is **never** committed to GitHub (protected by `.gitignore`).

Instead, add variables in **Railway Dashboard → Variables**:

```
DB_HOST=your-db-host
DB_USER=your-db-user
DB_PASSWORD=your-db-password
JWT_SECRET=your-secret-key
PAYPAL_CLIENT_ID=your-paypal-id
...
```

Railway automatically injects these when deploying.

---

## 🚨 Troubleshooting

### "Push rejected"
```bash
# Pull latest changes first
git pull origin main
# Then push again
git push
```

### "Deployment failed"
1. Check Railway logs
2. Common issues:
   - Database connection string wrong
   - Missing environment variables
   - Typo in code

Solution: Fix locally, commit, push again.

### "Port already in use"
Railway handles this automatically. Check logs for the actual port.

---

## 📋 Workflow Example

**Scenario:** You fixed a bug in ESP32 firmware

```bash
# 1. Make changes
vim esp32_door_control.ino

# 2. Test locally
npm run dev
# Test in browser/Postman

# 3. Commit
git add esp32_door_control.ino
git commit -m "Fix: RFID timeout issue"

# 4. Push
git push

# 5. Railway auto-deploys (watch logs)
# 6. Test live API
curl https://your-app.up.railway.app/health
```

**Done in ~2 minutes!** ⚡

---

## 🔒 Security Checklist

Before pushing:

- [ ] No `.env` file in commit (check `.gitignore`)
- [ ] No API keys in code
- [ ] No passwords in comments
- [ ] No credentials in commit messages
- [ ] Check: `git status` before push

```bash
# Verify what you're pushing
git status
git diff --cached
```

---

## 🌳 Git Workflow

### Daily Development
```bash
# Every change
git add .
git commit -m "Clear description"
git push
```

### Multiple Features
```bash
# Create feature branch
git checkout -b feature/new-payment-system

# Make changes
git add .
git commit -m "Implement PayPal integration"

# Merge to main
git checkout main
git merge feature/new-payment-system
git push
```

---

## 📱 Deploy ESP32 Updates Too

Your ESP32 firmware also connects to the API.

When you update `esp32_door_control.ino`:

1. Edit the file
2. Commit & push to GitHub
3. Railway deploys API
4. Update ESP32 firmware locally via Arduino IDE
5. ESP32 uses new API automatically ✨

---

## 🎯 Benefits of This Setup

✅ **One-click Deploy:** Push to GitHub, Railway handles the rest  
✅ **No Manual Deployment:** Never SSH into servers  
✅ **Automatic Backups:** GitHub is your backup  
✅ **Version History:** Track every change  
✅ **Team Collaboration:** Multiple people can push  
✅ **Rollback:** Revert to previous version anytime  
✅ **CI/CD Ready:** Add automated tests later  

---

## 📞 Need Help?

- **GitHub Docs:** https://docs.github.com
- **Railway Docs:** https://docs.railway.app
- **Git Basics:** https://git-scm.com/doc

---

**You're all set!** 🚀

From now on: Code → Commit → Push → Live!

