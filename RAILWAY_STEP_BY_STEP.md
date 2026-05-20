# Railway Deployment - Step-by-Step Instructions

**⏱️ Time to Live: 15-20 minutes**  
**💰 Cost: FREE for first month, then $5-15/month**

---

## Step 1: Sign Up for Railway (2 min)

1. Go to: https://railway.app
2. Click **"Sign Up"**
3. Select **"Continue with GitHub"**
4. Authorize Railway to access your GitHub account
5. Choose a username
6. ✅ Done!

---

## Step 2: Create GitHub Repository (3 min)

If you don't have your code on GitHub:

1. Go to: https://github.com/new
2. Create repository name: `smart-public-toilet`
3. Choose **"Public"** (so Railway can access it)
4. Click **"Create repository"**
5. In your local terminal:
   ```bash
   cd c:\NEW_PROJECT_CODES\smart-public-toilet
   git init
   git add .
   git commit -m "Initial commit - Smart Toilet System"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/smart-public-toilet.git
   git push -u origin main
   ```
6. ✅ Code is now on GitHub!

---

## Step 3: Create Railway Project (5 min)

1. Go to Railway dashboard: https://railway.app/dashboard
2. Click **"+ New Project"**
3. Select **"Deploy from GitHub"**
4. Find your `smart-public-toilet` repository
5. Click it to connect
6. Railway auto-detects Node.js project ✅
7. Click **"Deploy"**
8. ⏳ Wait 2-3 minutes for deployment...

---

## Step 4: Add Database (3 min)

1. In Railway dashboard, your project should be deploying
2. Click **"+ Add Service"**
3. Select **"Database"**
4. Choose **"PostgreSQL"** (or MySQL if you prefer)
5. Select **"Create New"**
6. ⏳ Wait for database to initialize (2 min)
7. ✅ Database is now running!

---

## Step 5: Configure Environment Variables (3 min)

1. Click on your **project name** in Railway
2. Go to **"Variables"** tab
3. Click **"Raw Editor"**
4. Paste this (update the values):

```
NODE_ENV=production
PORT=5000
API_URL=https://YOUR_PROJECT_NAME.up.railway.app

DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_USER=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_NAME=${{Postgres.PGDATABASE}}

JWT_SECRET=super-secret-key-32-chars-long-12345678
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_SECRET=your-paypal-secret

ALLOWED_ORIGINS=https://YOUR_PROJECT_NAME.up.railway.app,http://localhost:3000

HARDWARE_API_KEY=your-hardware-secret-key
TOILET_COUNT=1
```

5. Replace:
   - `YOUR_PROJECT_NAME` with your Railway project name
   - `JWT_SECRET` with a random 32-char string
   - PayPal credentials (or leave blank for now)
6. Click **"Save"**
7. ✅ Variables saved!

---

## Step 6: View Live Application (2 min)

1. Go to your project in Railway
2. Click **"Open App"** button (top right)
3. You should see:
   ```
   ✅ API is running!
   ```
4. Test your API:
   ```
   https://YOUR_PROJECT_NAME.up.railway.app/health
   ```
   Should return: `{"status":"ok"}`

5. Swagger docs available at:
   ```
   https://YOUR_PROJECT_NAME.up.railway.app/api-docs
   ```

6. ✅ Your backend is LIVE!

---

## Step 7: Initialize Database (3 min)

In Railway dashboard:

1. Click **"Variables"** tab
2. Find your project environment variables
3. Copy `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
4. On your **local computer**, create a `.env` file:

```
DB_HOST=xxxx.railway.internal
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=xxxx
DB_NAME=railway
```

5. Run locally:
   ```bash
   npm run migrate
   npm run seed
   ```

6. ✅ Database tables created and seeded!

---

## Step 8: Get Your Public API URL

Your public API is now accessible at:

```
https://YOUR_PROJECT_NAME.up.railway.app
```

Examples of endpoints:
- **Health check:** `https://YOUR_PROJECT_NAME.up.railway.app/health`
- **API docs:** `https://YOUR_PROJECT_NAME.up.railway.app/api-docs`
- **RFID tap:** `POST https://YOUR_PROJECT_NAME.up.railway.app/api/hardware/rfid-tap`

📝 **Save this URL** - you'll need it for ESP32!

---

## Step 9: Update ESP32 Firmware

1. Open `esp32_door_control_DEPLOYMENT.ino` in Arduino IDE
2. Find these lines:

```cpp
#define DEPLOYMENT_LOCAL    0
#define DEPLOYMENT_CLOUD    1  // ← Set this to 1
```

3. Change:
```cpp
#define DEPLOYMENT_LOCAL    0
#define DEPLOYMENT_CLOUD    1
```

4. Find:
```cpp
const char* SERVER_DOMAIN = "your-app-name.up.railway.app";
```

5. Replace with your actual domain:
```cpp
const char* SERVER_DOMAIN = "YOUR_PROJECT_NAME.up.railway.app";
```

6. Update WiFi:
```cpp
const char* WIFI_SSID     = "Your WiFi Name";
const char* WIFI_PASSWORD = "Your WiFi Password";
```

7. Verify settings:
```cpp
const int   SERVER_PORT   = 443;   // ✓ HTTPS
const bool  USE_HTTPS     = true;  // ✓ HTTPS enabled
const int   TOILET_ID     = 1;     // ✓ Unique ID
```

8. Compile and flash to ESP32
9. ✅ ESP32 will now connect to your cloud API!

---

## Step 10: Test End-to-End (5 min)

### Test 1: API is responding
```bash
curl https://YOUR_PROJECT_NAME.up.railway.app/health
```
Expected: `{"status":"ok"}`

### Test 2: RFID endpoint works
```bash
curl -X POST https://YOUR_PROJECT_NAME.up.railway.app/api/hardware/rfid-tap \
  -H "Content-Type: application/json" \
  -d '{"uid":"AA:BB:CC:DD","toilet_id":1}'
```
Expected: `{"command":"...","message":"..."}`

### Test 3: ESP32 connects
1. Open Arduino IDE Serial Monitor
2. Power on ESP32
3. Watch for:
   ```
   ✅ WiFi connected
   ✅ Server: https://YOUR_PROJECT_NAME.up.railway.app
   ```
4. Tap RFID card
5. Check serial output:
   ```
   📡 [RFID] Server HTTP 200
   ✅ ACCESS GRANTED
   🚪 DOOR: Opening
   ```

---

## 🎉 You're Live!

Your smart toilet system is now **publicly accessible** at:

```
https://YOUR_PROJECT_NAME.up.railway.app
```

---

## 📊 Monitor Your App

### View Logs
In Railway dashboard, click **"Logs"** tab to see:
- Server startup messages
- API requests
- Errors
- Database connections

### View Metrics
Click **"Metrics"** tab to see:
- CPU usage
- Memory usage
- Request rate
- Response time

### Restart App
If something breaks:
1. Click your project
2. Click the three dots `...`
3. Select **"Redeploy"**
4. Wait 30 seconds
5. App restarts automatically ✅

---

## 💰 Pricing

Railway gives you:
- **100 free compute hours per month** (~$5 credit)
- **Free PostgreSQL database** (up to 10GB)
- **Free deployments** (unlimited)

After free tier:
- Compute: ~$0.05 per hour (when running)
- Database: ~$10/month
- **Total: ~$15/month for full system**

---

## 🆘 Troubleshooting

### "Database connection failed"
1. Check `DB_HOST`, `DB_USER`, `DB_PASSWORD` in Railway Variables
2. Verify they're correct:
   ```bash
   railway variables
   ```
3. Check PostgreSQL service is running (green status)

### "ESP32 can't connect"
1. Verify WiFi is working (check serial)
2. Verify `SERVER_DOMAIN` is correct
3. Try manually:
   ```bash
   curl https://YOUR_PROJECT_NAME.up.railway.app/health
   ```
4. If it fails, check Railway logs

### "CORS Error on frontend"
1. Add your frontend URL to `ALLOWED_ORIGINS` in Railway Variables
2. Example:
   ```
   ALLOWED_ORIGINS=https://YOUR_PROJECT_NAME.up.railway.app,https://your-frontend.com
   ```

### "Port already in use"
1. Railway automatically uses port 5000
2. Check `.env` has `PORT=5000`
3. Redeploy from Railway dashboard

---

## ✅ Next Steps

1. **Optional:** Set up custom domain (not required)
   - Buy domain from Namecheap / GoDaddy
   - Point to Railway
   - Takes 24-48 hours

2. **Optional:** Deploy frontend dashboard
   - Create React/Vue app
   - Deploy to Vercel
   - Point to your Railway API

3. **Optional:** Enable payment gateway
   - PayPal Developer account
   - Get API keys
   - Add to Railway Variables
   - Test in sandbox

---

## 📞 Help & Support

- **Railway Docs:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway
- **Project Status:** https://railway.app/status

---

## 🎯 You Now Have

✅ **Public API server** - Accessible worldwide  
✅ **Database** - PostgreSQL, backed up automatically  
✅ **HTTPS** - Secure connections (free SSL)  
✅ **Auto-scaling** - Handles traffic spikes  
✅ **Monitoring** - See logs and metrics  
✅ **Easy redeploy** - Push to GitHub, Railway auto-deploys  

**Total time to live: ~15 minutes!** ⚡

