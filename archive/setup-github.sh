#!/bin/bash
# Smart Toilet - Complete GitHub & Deployment Setup Script
# Run this once, then just push to GitHub for auto-deployment!

set -e  # Exit on error

echo "🚀 Smart Toilet - Automated Setup Script"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."
command -v git >/dev/null 2>&1 || { echo "❌ Git not installed"; exit 1; }
echo "✅ Git found"

# Get user input
read -p "🔧 Enter GitHub username: " GITHUB_USER
read -p "📁 Enter repository name (default: smart-public-toilet): " REPO_NAME
REPO_NAME=${REPO_NAME:-smart-public-toilet}

echo ""
echo "📋 Configuration Summary:"
echo "  GitHub User: $GITHUB_USER"
echo "  Repo Name: $REPO_NAME"
echo "  Repo URL: https://github.com/$GITHUB_USER/$REPO_NAME"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 1
fi

# Initialize Git if needed
if [ ! -d ".git" ]; then
  echo "📦 Initializing Git repository..."
  git init
  echo "✅ Git initialized"
else
  echo "✅ Git repository already exists"
fi

# Configure Git
echo ""
echo "🔐 Configuring Git..."
git config user.email "toilet@localhost" || true
git config user.name "Smart Toilet System" || true

# Create .gitignore if it doesn't exist
if [ ! -f ".gitignore" ]; then
  echo "📝 Creating .gitignore..."
  cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables (NEVER commit!)
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Build outputs
dist/
build/
.next/

# Database
*.db
*.sqlite

# Temporary files
tmp/
temp/
EOF
  echo "✅ .gitignore created"
fi

# Stage all files
echo ""
echo "📤 Staging files..."
git add .
echo "✅ Files staged"

# Initial commit
if [ -z "$(git log --oneline -n 1 2>/dev/null)" ]; then
  echo ""
  echo "💾 Creating initial commit..."
  git commit -m "🚽 Initial commit - Smart Public Toilet IoT System

- ESP32 firmware with RFID, sensors, servos, relay
- Node.js/Express backend with JWT authentication
- Payment gateway integration (PayPal/Stripe)
- Real-time occupancy monitoring
- Database migrations and seeding
- Deployment configurations (Docker, Railway, Heroku)
- Ready for cloud deployment"
  echo "✅ Initial commit created"
else
  echo "✅ Repository already has commits"
fi

# Add remote
echo ""
echo "🌐 Adding GitHub remote..."
REMOTE_URL="https://github.com/$GITHUB_USER/$REPO_NAME.git"

if git remote | grep -q origin; then
  CURRENT_REMOTE=$(git config --get remote.origin.url)
  if [ "$CURRENT_REMOTE" != "$REMOTE_URL" ]; then
    echo "⚠️  Changing remote from $CURRENT_REMOTE to $REMOTE_URL"
    git remote set-url origin "$REMOTE_URL"
  fi
else
  git remote add origin "$REMOTE_URL"
fi
echo "✅ Remote URL: $REMOTE_URL"

# Instructions for pushing
echo ""
echo -e "${YELLOW}════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Local Setup Complete!${NC}"
echo -e "${YELLOW}════════════════════════════════════════════════════${NC}"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1️⃣  CREATE REPOSITORY ON GITHUB:"
echo "   - Go to: https://github.com/new"
echo "   - Repository name: $REPO_NAME"
echo "   - Select: Public"
echo "   - DO NOT initialize with README/gitignore/.gitattributes"
echo "   - Click: Create repository"
echo ""
echo "2️⃣  PUSH TO GITHUB (run one of these):"
echo ""
echo "   With HTTPS (easier first time):"
echo "   ${GREEN}git push -u origin main${NC}"
echo ""
echo "   With SSH (recommended):"
echo "   ${GREEN}git push -u origin main${NC}"
echo ""
echo "3️⃣  CONNECT TO RAILWAY (for auto-deployment):"
echo "   - Go to: https://railway.app"
echo "   - Sign in with GitHub"
echo "   - New Project → Deploy from GitHub"
echo "   - Select: $REPO_NAME"
echo "   - Add PostgreSQL database service"
echo "   - Add environment variables (see .env.example)"
echo "   - Deploy!"
echo ""
echo "4️⃣  FUTURE UPDATES (just push!):"
echo "   ${GREEN}git add ."
echo "   git commit -m 'Your changes'"
echo "   git push${NC}"
echo ""
echo "   Railway will auto-deploy within seconds! 🚀"
echo ""
echo -e "${YELLOW}════════════════════════════════════════════════════${NC}"
echo ""
echo "📚 Guides available:"
echo "   - RAILWAY_STEP_BY_STEP.md (15 min setup)"
echo "   - DEPLOYMENT_GUIDE.md (comprehensive)"
echo "   - QUICK_DEPLOY.md (quick reference)"
echo ""
