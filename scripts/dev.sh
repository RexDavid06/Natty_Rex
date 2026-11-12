#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="${PYTHON:-python}"
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  trap - INT TERM EXIT
  [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

if [[ ! -f "$ROOT/.env" ]]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  echo "Created .env from .env.example — review it before continuing."
fi

cd "$ROOT/backend"
"$PYTHON" manage.py migrate --noinput
"$PYTHON" manage.py runserver 0.0.0.0:8000 &
BACKEND_PID=$!

cd "$ROOT/frontend"
npm run dev -- --host &
FRONTEND_PID=$!

echo "Nattyrex API:  http://localhost:8000"
echo "Nattyrex app:  http://localhost:5173"
echo "API docs:      http://localhost:8000/api/docs/"
echo "Press Ctrl+C to stop both processes."

wait
