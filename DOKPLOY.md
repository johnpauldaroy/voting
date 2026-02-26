# Dokploy Deployment (Single Container)

This repository now includes a root `Dockerfile` that builds:
- Frontend (`frontend/`) with Vite
- Backend (`backend/`) with Laravel 11
- Runtime container with `nginx + php-fpm + supervisor`

It serves:
- SPA on `/`
- API on `/api/*`
- Sanctum CSRF endpoint on `/sanctum/csrf-cookie`

The image also sets PHP-FPM `clear_env = no` so Dokploy environment variables (for example `APP_KEY`) are available to Laravel during web requests.
It defaults Laravel logging to stderr (`LOG_CHANNEL=stderr`) for container-friendly logs.

## 1. Dokploy App Setup

1. Create a new app in Dokploy from this repo.
2. Build type: `Dockerfile`
3. Dockerfile path: `./Dockerfile`
4. Exposed port: `80`

## 2. Build Args (optional)

Set these if needed (defaults already work for same-domain deploy):
- `VITE_API_BASE_URL=/api`
- `VITE_API_ORIGIN=` (empty string)
- `VITE_API_URL=` (alias for API origin, useful for split-domain setup)

## 3. Required Environment Variables

At minimum set:
- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL=https://your-domain.com`
- `APP_KEY=base64:...`
- `DB_CONNECTION=mysql`
- `DB_HOST=...`
- `DB_PORT=3306`
- `DB_DATABASE=...`
- `DB_USERNAME=...`
- `DB_PASSWORD=...`
- `SESSION_SECURE_COOKIE=true`
- `SESSION_SAME_SITE=lax`
- `SANCTUM_STATEFUL_DOMAINS=your-domain.com`
- `CORS_ALLOWED_ORIGINS=https://your-domain.com`
- `FORCE_HTTPS=true`

Optional:
- `RUN_MIGRATIONS=true` (runs `php artisan migrate --force` on container start)
- `LOG_CHANNEL=stderr` (recommended; avoids filesystem log permission issues)

## 4. First Deploy Checklist

1. Generate `APP_KEY` locally if needed:
   - `cd backend && php artisan key:generate --show`
2. Configure DB values in Dokploy.
3. Deploy.
4. Hit health endpoint: `https://your-domain.com/up`
