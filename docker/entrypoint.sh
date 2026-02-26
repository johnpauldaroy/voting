#!/usr/bin/env sh
set -eu

cd /var/www/backend

if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
fi

# Ensure APP_KEY is persisted in .env so Laravel can boot even if runtime env forwarding is restricted.
if [ -n "${APP_KEY:-}" ]; then
  if grep -q '^APP_KEY=' .env; then
    sed -i "s|^APP_KEY=.*|APP_KEY=${APP_KEY}|" .env
  else
    printf '\nAPP_KEY=%s\n' "${APP_KEY}" >> .env
  fi
fi

mkdir -p \
  bootstrap/cache \
  storage/framework/cache \
  storage/framework/sessions \
  storage/framework/testing \
  storage/framework/views \
  storage/logs

chown -R www-data:www-data storage bootstrap/cache

php artisan storage:link >/dev/null 2>&1 || true
php artisan optimize:clear >/dev/null 2>&1 || true
php artisan config:cache >/dev/null 2>&1 || true

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  php artisan migrate --force
fi

exec /usr/bin/supervisord -c /etc/supervisord.conf
