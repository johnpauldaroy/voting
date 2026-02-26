# Deployment Guide

## Architecture
- Backend API: `backend/` (Laravel 11, Sanctum, MySQL)
- Frontend SPA: `frontend/` (React + Vite + TypeScript)

## 1. Backend Production Setup
1. Configure server with PHP 8.2+, Composer, MySQL 8+, Nginx/Apache, SSL.
2. Copy environment file:
   - `cp backend/.env.example backend/.env`
3. Configure required values in `backend/.env`:
   - `APP_ENV=production`
   - `APP_DEBUG=false`
   - `APP_URL=https://api.your-domain.com`
   - `DB_CONNECTION=mysql`
   - `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
   - `SESSION_SECURE_COOKIE=true`
   - `SESSION_SAME_SITE=lax`
   - `SANCTUM_STATEFUL_DOMAINS=app.your-domain.com`
   - `CORS_ALLOWED_ORIGINS=https://app.your-domain.com`
   - `FORCE_HTTPS=true`
4. Install dependencies and optimize:
   - `cd backend`
   - `composer install --no-dev --optimize-autoloader`
   - `php artisan key:generate`
   - `php artisan migrate --force`
   - `php artisan db:seed --force`
   - `php artisan config:cache`
   - `php artisan route:cache`
   - `php artisan event:cache`
5. Configure scheduler and queue worker:
   - Cron: `* * * * * php /path/to/backend/artisan schedule:run >> /dev/null 2>&1`
   - Queue worker (systemd/supervisor): `php artisan queue:work --sleep=3 --tries=3`
6. Ensure web root points to `backend/public`.

## 2. Frontend Production Setup
1. Copy environment file:
   - `cp frontend/.env.example frontend/.env`
2. Set API values:
   - `VITE_API_BASE_URL=https://api.your-domain.com/api`
   - `VITE_API_ORIGIN=https://api.your-domain.com`
3. Build and deploy static files:
   - `cd frontend`
   - `npm ci`
   - `npm run build`
   - Deploy `frontend/dist/` to CDN/Nginx hosting.
4. Use HTTPS and same top-level domain where possible (`app.your-domain.com` + `api.your-domain.com`).

## 3. Web Server Security (Nginx Example)
- Enforce HTTPS redirect.
- Add HSTS header.
- Deny access to dotfiles and sensitive files.
- Limit request body size.
- Enable TLS 1.2+ only.

## 4. Database Backup Strategy
- Daily logical backup (`mysqldump`) with retention policy.
- Weekly full snapshot backup.
- Encrypt backups at rest.
- Test restore process monthly.

## 5. Health Checks
- Backend health endpoint: `GET /up`
- Frontend uptime monitoring on `/`
- Alerting on login failures, 5xx spikes, and DB connectivity
