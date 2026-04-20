#!/bin/bash
# ─── Simon Express Carrier Onboarding — Deploy Script ───
# Run this from the project root after extracting the tar.gz

echo "🚛 Simon Express Carrier Onboarding — Deploy to Vercel"
echo "======================================================="
echo ""

# Check for node
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Install from https://nodejs.org"
    exit 1
fi

# Install deps
echo "📦 Installing dependencies..."
npm install

# Check for Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

echo ""
echo "🔑 Setting up environment variables..."
echo "   You'll be prompted for each secret value."
echo ""

# Prompt for env vars
read -p "Resend API Key (from resend.com): " RESEND_KEY
read -p "From Email (e.g. onboarding@simonexpress.com): " FROM_EMAIL
read -p "Carrier411 Username: " C411_USER
read -sp "Carrier411 Password: " C411_PASS
echo ""
read -p "FMCSA API Key (optional, press Enter to skip): " FMCSA_KEY

# Create .env.local for local testing
cat > .env.local << ENVEOF
RESEND_API_KEY=${RESEND_KEY}
FROM_EMAIL=${FROM_EMAIL:-onboarding@simonexpress.com}
CARRIER411_USERNAME=${C411_USER}
CARRIER411_PASSWORD=${C411_PASS}
FMCSA_API_KEY=${FMCSA_KEY}
ENVEOF

echo ""
echo "✅ .env.local created for local development"
echo ""

# Deploy
echo "🚀 Deploying to Vercel..."
vercel deploy --prod

echo ""
echo "⚠️  IMPORTANT: Add these environment variables in Vercel Dashboard:"
echo "   → Go to your project → Settings → Environment Variables"
echo "   → Add each variable from .env.local"
echo ""
echo "Done! 🎉"
