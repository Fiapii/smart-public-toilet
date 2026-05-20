@echo off
REM Smart Toilet - Complete GitHub & Deployment Setup Script (Windows)
REM Run this once, then just push to GitHub for auto-deployment!

echo.
echo 🚀 Smart Toilet - Automated Setup Script (Windows)
echo ================================================
echo.

REM Check if Git is installed
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Git is not installed or not in PATH
    echo Please install Git from: https://git-scm.com/download/win
    pause
    exit /b 1
)
echo ✅ Git found

REM Get user input
set /p GITHUB_USER="🔧 Enter GitHub username: "
set /p REPO_NAME="📁 Enter repository name (default: smart-public-toilet): "
if "%REPO_NAME%"=="" set REPO_NAME=smart-public-toilet

echo.
echo 📋 Configuration Summary:
echo   GitHub User: %GITHUB_USER%
echo   Repo Name: %REPO_NAME%
echo   Repo URL: https://github.com/%GITHUB_USER%/%REPO_NAME%
echo.
set /p CONFIRM="Continue? (y/n): "
if /i not "%CONFIRM%"=="y" (
    echo Cancelled.
    exit /b 1
)

REM Initialize Git if needed
if not exist ".git" (
    echo 📦 Initializing Git repository...
    git init
    echo ✅ Git initialized
) else (
    echo ✅ Git repository already exists
)

REM Configure Git
echo.
echo 🔐 Configuring Git...
git config user.email "toilet@localhost"
git config user.name "Smart Toilet System"

REM Create .gitignore if it doesn't exist
if not exist ".gitignore" (
    echo 📝 Creating .gitignore...
    (
        echo # Dependencies
        echo node_modules/
        echo npm-debug.log*
        echo yarn-debug.log*
        echo yarn-error.log*
        echo.
        echo # Environment variables (NEVER commit!
        echo .env
        echo .env.local
        echo .env.*.local
        echo.
        echo # IDE
        echo .vscode/
        echo .idea/
        echo *.swp
        echo *.swo
        echo *~
        echo.
        echo # OS
        echo .DS_Store
        echo Thumbs.db
        echo.
        echo # Logs
        echo logs/
        echo *.log
        echo.
        echo # Build outputs
        echo dist/
        echo build/
        echo .next/
        echo.
        echo # Database
        echo *.db
        echo *.sqlite
        echo.
        echo # Temporary files
        echo tmp/
        echo temp/
    ) > .gitignore
    echo ✅ .gitignore created
)

REM Stage all files
echo.
echo 📤 Staging files...
git add .
echo ✅ Files staged

REM Initial commit
echo.
echo 💾 Creating initial commit...
git commit -m "Initial commit - Smart Public Toilet IoT System"
if errorlevel 1 (
    echo ✅ Repository already has commits
) else (
    echo ✅ Initial commit created
)

REM Add remote
echo.
echo 🌐 Adding GitHub remote...
set REMOTE_URL=https://github.com/%GITHUB_USER%/%REPO_NAME%.git

git remote get-url origin >nul 2>&1
if errorlevel 1 (
    git remote add origin %REMOTE_URL%
) else (
    git remote set-url origin %REMOTE_URL%
)
echo ✅ Remote URL: %REMOTE_URL%

REM Print instructions
echo.
echo ════════════════════════════════════════════════════
echo ✅ Local Setup Complete!
echo ════════════════════════════════════════════════════
echo.
echo 📋 Next Steps:
echo.
echo 1️⃣  CREATE REPOSITORY ON GITHUB:
echo    - Go to: https://github.com/new
echo    - Repository name: %REPO_NAME%
echo    - Select: Public
echo    - DO NOT initialize with README/gitignore
echo    - Click: Create repository
echo.
echo 2️⃣  PUSH TO GITHUB:
echo    git push -u origin main
echo.
echo 3️⃣  CONNECT TO RAILWAY:
echo    - Go to: https://railway.app
echo    - Sign in with GitHub
echo    - New Project → Deploy from GitHub
echo    - Select: %REPO_NAME%
echo    - Add PostgreSQL database
echo    - Add environment variables
echo    - Deploy!
echo.
echo 4️⃣  FUTURE UPDATES (just push!):
echo    git add .
echo    git commit -m "Your changes"
echo    git push
echo.
echo    Railway will auto-deploy automatically! 🚀
echo.
echo ════════════════════════════════════════════════════
echo.
pause
