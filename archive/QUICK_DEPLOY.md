# Smart Toilet - Quick Start Deployment Guide

## 🚀 Deploy in 5 Minutes (Railway)

### Step 1: Sign Up
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Connect your GitHub account

### Step 2: Configure Environment
```bash
# In your project root
cp .env.example .env
# Edit .env with your database and API credentials
```

### Step 3: Push to GitHub
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### Step 4: Deploy
1. Go to Railway dashboard
2. Click "New Project"
3. Select "Deploy from GitHub"
4. Choose your repository
5. Add environment variables from `.env`
6. Add PostgreSQL/MySQL database service
7. Click Deploy ✅

### Step 5: Update ESP32
Replace in `esp32_door_control.ino`:
```cpp
const char* SERVER_DOMAIN = "your-app-name.up.railway.app";
const bool  USE_HTTPS     = true;
```

---

## 📊 System Status Checks

### Check Backend Health
```bash
curl https://your-app-name.up.railway.app/health
```

### Test RFID Endpoint
```bash
curl -X POST https://your-app-name.up.railway.app/api/hardware/rfid-tap \
  -H "Content-Type: application/json" \
  -d '{"uid":"AA:BB:CC:DD","toilet_id":1}'
```

### View Logs
```bash
railway logs
```

---

## 💰 Cost Breakdown

| Service | Cost/Month | Notes |
|---------|-----------|-------|
| Railway App | $5-15 | Includes 100 hours free/month |
| PostgreSQL | $0-10 | Free tier available |
| Domain | $12 | Optional (Namecheap) |
| **Total** | **~$17-37** | Production-ready |

---

## 🔒 Security Checklist

- [ ] JWT_SECRET is strong (32+ chars, random)
- [ ] Database password is strong
- [ ] CORS allowed origins restricted
- [ ] HTTPS enforced (auto on Railway)
- [ ] API rate limiting enabled
- [ ] Logs are being collected
- [ ] Database backups scheduled
- [ ] Sensitive keys NOT in code (use .env)

---

## 🆘 Troubleshooting

### "Connection Refused"
- Check if backend is running: `railway logs`
- Verify DATABASE connection: `railway variables`

### "Database Error"
- Check PlanetScale credentials
- Ensure database IP whitelist includes Railway
- Run migrations: `npm run migrate`

### "CORS Error"
- Add frontend URL to ALLOWED_ORIGINS
- Verify in Railway variables

### "HTTPS Certificate Error on ESP32"
- Temporarily disable SSL verification (unsafe for production)
- Or use a proper SSL certificate

---

## 📞 Support

- Railway Docs: https://docs.railway.app
- Express Docs: https://expressjs.com
- Troubleshooting: See DEPLOYMENT_GUIDE.md

