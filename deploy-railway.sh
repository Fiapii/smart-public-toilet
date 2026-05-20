#!/bin/bash
# Quick deployment script for Railway

echo "🚀 Smart Toilet - Deployment Script"
echo "===================================="

# Check if Git is initialized
if [ ! -d ".git" ]; then
  echo "📦 Initializing Git repository..."
  git init
  git add .
  git commit -m "Initial commit - Ready for deployment"
fi

# Check if environment file exists
if [ ! -f ".env" ]; then
  echo "⚠️  .env file not found!"
  echo "📋 Creating .env from .env.example..."
  cp .env.example .env
  echo "✏️  Please edit .env with your configuration"
  exit 1
fi

# Install Railway CLI if not installed
if ! command -v railway &> /dev/null; then
  echo "📥 Installing Railway CLI..."
  npm install -g @railway/cli
fi

# Login to Railway
echo "🔐 Logging in to Railway..."
railway login

# Create/link project
echo "📁 Setting up Railway project..."
railway init

# Deploy
echo "🚀 Deploying to Railway..."
railway up

echo ""
echo "✅ Deployment complete!"
echo ""
echo "To view logs: railway logs"
echo "To set environment variables: railway variables"
echo "To link local project: railway link"
echo ""
