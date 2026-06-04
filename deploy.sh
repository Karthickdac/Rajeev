#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Ungaludan Sarath — VPS Deploy Script
#
# One-time setup on the VPS:
#   1. git clone https://github.com/Karthickdac/Sarath \
#        /home/ungaludansarath/htdocs/ungaludansarath.tamilagavetrikalagam.com
#   2. cd into that folder, copy .env.example to .env, fill in real values,
#      then lock it down:  chmod 600 .env
#   3. Make sure pnpm + PM2 are installed:  npm i -g pnpm pm2
#
# Flags:
#   SKIP_DB_PUSH=1 bash deploy.sh   # skip the schema sync step (see step 5)
#
# Every deploy after that:
#   bash deploy.sh
#
# The app runs as a single Node process on PORT (default 5500) and serves BOTH
# the website and the /api routes. Point CloudPanel's reverse proxy (or Nginx)
# for the domain at http://127.0.0.1:5500  (see nginx.conf.example).
# ─────────────────────────────────────────────────────────────

set -e

DEPLOY_DIR="/home/ungaludansarath/htdocs/ungaludansarath.tamilagavetrikalagam.com"
APP_NAME="ungaludan-sarath"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║       Ungaludan Sarath — Deploying...         ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

cd "$DEPLOY_DIR"

# ── 0. Load environment (DATABASE_URL, JWT_SECRET, …) ─────────
if [ -f "$DEPLOY_DIR/.env" ]; then
  echo "▶ Loading .env..."
  set -a
  # shellcheck disable=SC1091
  . "$DEPLOY_DIR/.env"
  set +a
else
  echo "✗ No .env file found at $DEPLOY_DIR/.env"
  echo "  Copy .env.example to .env and fill in your values, then re-run."
  exit 1
fi

# ── 1. Pull latest changes ────────────────────────────────────
echo "▶ Pulling latest changes..."
git pull origin main

# ── 2. Install dependencies ───────────────────────────────────
echo "▶ Installing dependencies..."
pnpm install --frozen-lockfile

# ── 3. Build API server (esbuild bundle) ──────────────────────
echo "▶ Building API server..."
pnpm --filter @workspace/api-server run build

# ── 4. Build frontend (Vite → dist/public) ────────────────────
echo "▶ Building frontend..."
pnpm --filter @workspace/logesh-connect run build

# ── 5. Sync database schema ───────────────────────────────────
# Uses drizzle "push" (schema-sync). It compares the schema to the live DB and
# applies changes in place. On a fresh DB this creates all tables; on an
# existing DB review changes first if you have manual edits. Skip with
# SKIP_DB_PUSH=1 if you manage the schema yourself.
if [ "${SKIP_DB_PUSH:-0}" = "1" ]; then
  echo "▶ Skipping database schema push (SKIP_DB_PUSH=1)."
else
  echo "▶ Syncing database schema (drizzle push)..."
  pnpm --filter @workspace/db run push
fi

# ── 6. (Re)start the PM2 process ──────────────────────────────
mkdir -p "$DEPLOY_DIR/logs"
echo "▶ Restarting service..."
if pm2 list | grep -q "$APP_NAME"; then
  pm2 restart "$APP_NAME" --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

# ── 7. Health check ───────────────────────────────────────────
PORT_VAL="${PORT:-5500}"
echo "▶ Waiting for the app to respond on :$PORT_VAL ..."
OK=0
for i in $(seq 1 15); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT_VAL}/" || true)
  if [ "$CODE" = "200" ]; then OK=1; break; fi
  sleep 1
done

echo ""
if [ "$OK" = "1" ]; then
  echo "✅ Deployment complete — app responded 200 on http://127.0.0.1:${PORT_VAL}"
else
  echo "⚠ Deployment finished but the app did not return 200 yet."
  echo "  Check logs:  pm2 logs $APP_NAME"
fi
echo "   Logs: pm2 logs $APP_NAME"
echo ""
