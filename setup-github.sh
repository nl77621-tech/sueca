#!/bin/bash
# ────────────────────────────────────────────────────────
# Sueca – GitHub & Railway Setup Script
# Run this from inside your Sueca folder:
#   cd /path/to/Sueca && bash setup-github.sh
# ────────────────────────────────────────────────────────

set -e

REPO_NAME="sueca"
GITHUB_USER=$(gh api user --jq .login 2>/dev/null || echo "")

if [ -z "$GITHUB_USER" ]; then
  echo "🔐 Logging in to GitHub..."
  gh auth login
  GITHUB_USER=$(gh api user --jq .login)
fi

echo ""
echo "👤 GitHub user: $GITHUB_USER"
echo "📦 Creating repo: $REPO_NAME ..."

# Create the GitHub repo (public)
gh repo create "$REPO_NAME" \
  --public \
  --description "Sueca – Classic Portuguese Card Game 🃏" \
  --source=. \
  --remote=origin \
  --push

echo ""
echo "✅ Done! Your repo is live at:"
echo "   https://github.com/$GITHUB_USER/$REPO_NAME"
echo ""
echo "────────────────────────────────────────────────────"
echo "🚂 Railway Deployment:"
echo ""
echo "  1. Go to https://railway.app"
echo "  2. Click 'New Project' → 'Deploy from GitHub repo'"
echo "  3. Select: $GITHUB_USER/$REPO_NAME"
echo "  4. Railway will auto-detect Node.js."
echo "     Make sure these settings are set:"
echo ""
echo "     Build Command:  npm run build"
echo "     Start Command:  npm run preview"
echo ""
echo "  5. Click 'Deploy' — live in ~1 minute! 🎉"
echo "────────────────────────────────────────────────────"
