#!/usr/bin/env sh
set -eu
umask 0002

cd /var/www/backend

if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
fi

persist_env_var() {
  var_name="$1"
  eval "var_value=\${$var_name:-}"

  if [ -z "${var_value}" ]; then
    return
  fi

  escaped_value="$(printf '%s' "${var_value}" | sed 's/[\/&]/\\&/g')"

  if grep -q "^${var_name}=" .env; then
    sed -i "s/^${var_name}=.*/${var_name}=${escaped_value}/" .env
  else
    printf '\n%s=%s\n' "${var_name}" "${var_value}" >> .env
  fi
}

for env_key in \
  APP_NAME \
  APP_ENV \
  APP_DEBUG \
  APP_URL \
  APP_KEY \
  LOG_CHANNEL \
  LOG_LEVEL \
  LOG_STACK \
  DB_CONNECTION \
  DB_HOST \
  DB_PORT \
  DB_DATABASE \
  DB_USERNAME \
  DB_PASSWORD \
  CACHE_STORE \
  SESSION_DRIVER \
  QUEUE_CONNECTION \
  SESSION_SECURE_COOKIE \
  SESSION_SAME_SITE \
  SANCTUM_STATEFUL_DOMAINS \
  CORS_ALLOWED_ORIGINS \
  FORCE_HTTPS
do
  persist_env_var "${env_key}"
done

if ! grep -q '^LOG_CHANNEL=' .env; then
  printf '\nLOG_CHANNEL=stderr\n' >> .env
fi

if ! grep -q '^LOG_LEVEL=' .env; then
  printf '\nLOG_LEVEL=info\n' >> .env
fi

if ! grep -q '^CACHE_STORE=' .env; then
  printf '\nCACHE_STORE=file\n' >> .env
fi

current_app_key="$(grep '^APP_KEY=' .env | head -n1 | cut -d= -f2- || true)"
if [ -z "${current_app_key}" ]; then
  php artisan key:generate --force --no-interaction
fi

mkdir -p \
  bootstrap/cache \
  storage/framework/cache \
  storage/framework/sessions \
  storage/framework/testing \
  storage/framework/views \
  storage/logs

touch storage/logs/laravel.log

chown -R www-data:www-data storage bootstrap/cache || true
chmod -R ug+rwX storage bootstrap/cache || true

php artisan storage:link >/dev/null 2>&1 || true
php artisan optimize:clear
php artisan config:cache

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  php artisan migrate --force
fi

exec /usr/bin/supervisord -c /etc/supervisord.conf
