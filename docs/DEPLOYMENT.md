# Deployment and operations

Nattyrex is designed to run as three containers behind a TLS reverse proxy: PostgreSQL, Django/Gunicorn, and nginx serving the PWA.

## 1. Prepare the environment

```bash
cp .env.example .env
```

Set at least:

```dotenv
DEBUG=False
SECRET_KEY=<64+ random characters>
ALLOWED_HOSTS=app.example.com
POSTGRES_DB=nattyrex
POSTGRES_USER=nattyrex
POSTGRES_PASSWORD=<url-safe-password>
WEB_PORT=80
FRONTEND_URL=https://app.example.com
CORS_ALLOWED_ORIGINS=https://app.example.com
CSRF_TRUSTED_ORIGINS=https://app.example.com
SECURE_SSL_REDIRECT=True
TIME_ZONE=Europe/London
```

Generate a secret with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

If `DEBUG=False` and `SECRET_KEY` is still the development default, Django refuses to start. Keep `DATABASE_URL` empty for local SQLite; Docker Compose constructs the PostgreSQL URL for you. If the password contains URL-unsafe characters, percent-encode it or supply a fully formed `DATABASE_URL`.

## 2. Start the stack

```bash
make docker-up
# or
docker compose up -d --build
```

The backend container waits for PostgreSQL, runs migrations, collects static files, then starts Gunicorn. nginx serves the built SPA, proxies the API and admin, and serves `/media/` from the shared media volume.

Check status:

```bash
docker compose ps
docker compose logs -f --tail=100
curl http://localhost/health/
```

### Render (backend API)

Render looks for a `Dockerfile` at the repository root by default, so the root `Dockerfile` builds the backend. The entrypoint runs migrations and `collectstatic` before Gunicorn starts.

1. Create a **Web Service** from this repository and choose **Docker**.
2. Leave **Root Directory** empty and **Dockerfile Path** as `Dockerfile` (the repository root).
3. Set **Health Check Path** to `/health/`.
4. Create a **PostgreSQL** instance and set `DATABASE_URL` to its internal connection string.
5. Add environment variables:

```dotenv
DEBUG=False
SECRET_KEY=<64+ random characters>
ALLOWED_HOSTS=nattyrex-backend.onrender.com
DATABASE_URL=postgres://...
FRONTEND_URL=https://<your-frontend-host>
CORS_ALLOWED_ORIGINS=https://<your-frontend-host>
CSRF_TRUSTED_ORIGINS=https://<your-frontend-host>
```

`SECURE_SSL_REDIRECT` defaults to `True` when `DEBUG=False`, which is correct behind Render's HTTPS proxy. Attach a persistent disk mounted at `/app/media` if uploaded videos must survive deploys.

Provision the trainer from the Render shell:

```bash
python manage.py create_trainer --email trainer@example.com --name "Coach Rex"
```

Deploy the frontend separately as a Static Site (build command `npm ci && npm run build`, publish directory `dist`) with `VITE_API_URL=https://nattyrex-backend.onrender.com/api/v1`.

## 3. Provision the trainer

```bash
docker compose exec backend python manage.py create_trainer \
  --email trainer@example.com \
  --name "Coach Rex"
```

You will be prompted for the password. There is deliberately no web signup for trainers. Re-running with the same email updates that trainer's password/name.

## 4. TLS

Terminate TLS at a load balancer, Cloudflare, Caddy or another reverse proxy in front of Nattyrex nginx:

- Forward to the `WEB_PORT` published by Compose.
- Preserve `X-Forwarded-Proto` and `Host`.
- Set `SECURE_SSL_REDIRECT=True`.
- Ensure `FRONTEND_URL`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` use the public HTTPS origin.

Nattyrex nginx honours an upstream `X-Forwarded-Proto` header, so Django sees HTTPS even though traffic between the proxy and nginx is HTTP.

## 5. Media storage

Default storage is the local `media_data` Docker volume mounted into both backend and nginx.

For large video libraries, use S3-compatible object storage:

1. Uncomment `django-storages[s3]` and `boto3` in `backend/requirements.txt`.
2. Set `STORAGE_BACKEND=s3` plus the `AWS_*` variables and rebuild.
3. Configure the bucket for private objects and signed URLs (`AWS_QUERYSTRING_AUTH=True`), or a CDN with appropriate access controls.
4. Keep uploads limited with `MAX_UPLOAD_MB` and nginx `client_max_body_size` (110 MB by default).

Never place trainer-uploaded media in a public bucket without an explicit access decision.

## 6. Email

Development logs email to the console through Django's console backend. For invitations/notifications by email, configure SMTP:

```dotenv
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_HOST_USER=...
EMAIL_HOST_PASSWORD=...
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=Nattyrex <no-reply@example.com>
```

Invitation links are generated in the API response and copied into the client UI; SMTP delivery is optional.

## 7. Backups

Back up both stateful pieces:

```bash
# Database
docker compose exec -T db pg_dump -U nattyrex nattyrex > nattyrex-$(date +%F).sql

# Media volume (example: inspect the actual volume name first)
docker compose exec -T backend tar czf - -C /app media > nattyrex-media-$(date +%F).tar.gz
```

Store backups encrypted and off-host. Test restores periodically. A database dump without the media volume will lose demonstration videos and thumbnails.

## 8. Updates

```bash
git pull
make docker-up
```

Migrations and static collection run automatically at container start. Back up first, and review migrations for destructive changes before deploying.

## 9. Smoke checks after deployment

1. `/health/` returns `{"status": "ok", "service": "nattyrex"}`.
2. `/api/docs/` opens (or schema at `/api/schema/`).
3. Trainer logs in and sees the dashboard.
4. Create a test client, open the invite link in a private window, accept, and confirm the client reaches `/app`.
5. Build a program, assign it, complete an exercise and a workout.
6. Confirm `/api/` is never cached by the service worker (DevTools → Application → Cache Storage).
7. Upload a small MP4 and verify it plays through `/media/`.

## 10. Troubleshooting

| Symptom | Check |
| --- | --- |
| Backend exits immediately | `docker compose logs backend`; `SECRET_KEY`/database settings |
| 400 Bad Request on all Host values | `ALLOWED_HOSTS` includes the public host |
| CSRF failures in admin | `CSRF_TRUSTED_ORIGINS` matches the HTTPS origin |
| Redirect loop behind TLS proxy | `X-Forwarded-Proto` preserved; `SECURE_SSL_REDIRECT=True` |
| Uploads 413 | `MAX_UPLOAD_MB` and nginx `client_max_body_size` |
| Media 404 | media volume mounted in backend and nginx; files exist under `/app/media` |
| PWA serves old JS | `/sw.js` must be served no-cache; latest deploy reloads on next visit |
| PostgreSQL won't initialise on Termux | Local SQLite is expected there; use PostgreSQL on a normal server |

## Local Termux notes

The development environment cannot initialise PostgreSQL because of filesystem ownership restrictions. Use SQLite locally (`DATABASE_URL=`), run `python manage.py migrate`, and rely on PostgreSQL in production. Pillow is intentionally not required; uploads are plain `FileField`s.
