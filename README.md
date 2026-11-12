# Nattyrex

Private, mobile-first personal training platform. One trainer manages clients, reusable exercise media, multi-week programs and client progress. Clients receive single-use invitation links, follow their weekly schedule, log workouts offline-friendly through the installed PWA, and track body measurements.

```
Natty_Rex/
├── backend/    Django 5 + DRF API (accounts, training)
├── frontend/   React 18 + TypeScript + Vite + Tailwind PWA
├── docs/       Architecture, API, deployment and testing guides
├── scripts/    Local development helper
├── docker-compose.yml
└── Makefile
```

## Highlights

- **Trainer-only provisioning** — there is no public trainer signup. The single trainer account is created with a management command.
- **Secure invitations** — hashed, single-use, expiring links; raw tokens are only returned once.
- **Program builder** — weeks, days, multiple sessions per day, drag-to-reorder exercises, copy week/day, assignment to multiple clients.
- **Exercise library** — reusable prescriptions, coaching cues, uploads or external video/animation URLs, preferred demonstration per exercise.
- **Client app** — today's workout, calendar, exercise logging, session completion, history and body progress.
- **Private API** — JWT access/refresh tokens, role-based permissions, trainer/client data isolation.
- **PWA** — installable app shell, offline fallback, API requests always network-only (private data is never cached).
- **Production stack** — PostgreSQL, Gunicorn, WhiteNoise, nginx, Docker Compose, media volume, health checks.

## Quick start (local, SQLite)

Requirements: Python 3.11+, Node 20+ and npm.

```bash
cp .env.example .env
# Edit .env. Leave DATABASE_URL empty to use SQLite locally.
make install
make migrate
make trainer                 # prompts for email/password/name
make dev
```

Open:

- App: http://localhost:5173
- API: http://localhost:8000/api/v1/
- Swagger: http://localhost:8000/api/docs/
- Health: http://localhost:8000/health/

`make dev` starts Django and Vite together. You can also use `make backend` and `make frontend` in separate terminals.

### Provision the trainer

```bash
cd backend
python manage.py create_trainer \
  --email trainer@example.com \
  --name "Coach Rex"
```

Omit `--password` to be prompted securely. The command refuses to create a second trainer account.

### Add a client

1. Sign in as the trainer.
2. Open **Clients → Add client**, enter a name plus email or phone.
3. Copy the generated invitation link or send it via WhatsApp.
4. The client opens `/invite/<token>`, sets a password and is signed in automatically.

Invitations are single-use, expire after `INVITATION_TTL_DAYS` (default 7) and can be revoked or regenerated. A new invitation revokes the previous unused one.

## Environment

All backend and frontend settings are read from the root `.env` (see `.env.example`). Important values:

| Variable | Purpose |
| --- | --- |
| `DEBUG` | `True` locally, `False` in production |
| `SECRET_KEY` | Long random Django secret; required when `DEBUG=False` |
| `ALLOWED_HOSTS` | Comma-separated hostnames |
| `DATABASE_URL` | Empty for SQLite, PostgreSQL URL in production |
| `FRONTEND_URL` | Used to build invitation links |
| `CORS_ALLOWED_ORIGINS` | Browser origins allowed to call the API directly |
| `INVITATION_TTL_DAYS` | Invitation lifetime |
| `MAX_UPLOAD_MB` | Maximum exercise video upload size |
| `MEDIA_ROOT` | Local media directory |
| `VITE_API_URL` | API base URL baked into the frontend |

The frontend runs with `envDir` set to the repository root, so Vite also reads `VITE_API_URL` from the root `.env`.

## Commands

| Command | What it does |
| --- | --- |
| `make env` | Create `.env` from the example if missing |
| `make install` | Install Python and npm dependencies |
| `make migrate` | Apply migrations |
| `make trainer` | Create/update the private trainer account |
| `make dev` | Run API and frontend together |
| `make backend` / `make frontend` | Run one side only |
| `make check` | Django checks and TypeScript typecheck |
| `make test` | Backend test suite and frontend Vitest suite |
| `make build` | Production frontend build |
| `make docker-up` | Build and start the production stack |
| `make docker-logs` | Follow container logs |

## Testing

```bash
make test
```

Backend coverage includes authentication, refresh/blacklist, invitation lifecycle, trainer/client permissions, program building, scheduling, assignment, media validation, workout completion and progress.

```bash
cd backend && python manage.py test
cd frontend && npm test
```

See [docs/TESTING.md](docs/TESTING.md) for details.

## Production with Docker

```bash
cp .env.example .env
# Set SECRET_KEY, POSTGRES_PASSWORD, ALLOWED_HOSTS, FRONTEND_URL,
# CORS_ALLOWED_ORIGINS, CSRF_TRUSTED_ORIGINS and email settings.
make docker-up
cd backend && docker compose exec backend python manage.py create_trainer \
  --email trainer@example.com --name "Coach Rex"
```

The stack contains PostgreSQL, Gunicorn/Django, and nginx serving the built PWA while proxying `/api`, `/admin`, `/static` and `/media`. Put a TLS-terminating reverse proxy or load balancer in front of port 80, enable `SECURE_SSL_REDIRECT=True`, and back up PostgreSQL plus the media volume. Full instructions: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Local constraints (Termux / Android)

This repository was developed in a Termux-like Debian environment:

- SQLite is used locally. The PostgreSQL cluster could not be initialised on this filesystem; PostgreSQL is configured through `DATABASE_URL` for production.
- Uploads use `FileField` (no Pillow dependency), so exercise videos, GIFs, WebP, PNG and JPEG files work without an image library.
- If the npm registry is unavailable, `npm install --offline` works with the committed lockfile. `jsdom@20.0.3` is pinned for compatibility with the local Node runtime.
- Regenerate PWA icons at any time with `python frontend/scripts/generate_icons.py` (no image library required).

## Documentation

- [Architecture and data model](docs/ARCHITECTURE.md)
- [API reference](docs/API.md)
- [Deployment and operations](docs/DEPLOYMENT.md)
- [Testing guide](docs/TESTING.md)

## Security notes

- Trainer provisioning is command-only; there is no trainer signup endpoint.
- Invitation tokens are stored as SHA-256 hashes. Only the freshly generated link contains the raw token.
- JWT refresh tokens rotate and are blacklisted on logout.
- Role permissions prevent clients from using trainer endpoints and trainers from reading each other's data. Cross-tenant lookups return 404.
- Service worker runtime caching is `NetworkOnly` for `/api/`; private API responses are never stored.
- Set a unique `SECRET_KEY`, serve over HTTPS and keep `.env` out of version control in production.
