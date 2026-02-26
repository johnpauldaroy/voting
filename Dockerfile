FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

ARG VITE_API_BASE_URL=/api
ARG VITE_API_ORIGIN=
ARG VITE_API_URL=

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_API_ORIGIN=${VITE_API_ORIGIN}
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build


FROM composer:2.7 AS backend-builder

WORKDIR /app/backend

COPY backend/composer.json backend/composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --no-scripts \
    --prefer-dist \
    --optimize-autoloader

COPY backend/ ./
RUN composer dump-autoload --optimize --no-dev --classmap-authoritative


FROM php:8.2-fpm-alpine AS runtime

WORKDIR /var/www

ENV LOG_CHANNEL=stderr
ENV LOG_LEVEL=info

RUN apk add --no-cache \
    bash \
    curl \
    icu-dev \
    libzip-dev \
    nginx \
    oniguruma-dev \
    supervisor \
    zip \
  && docker-php-ext-install \
    bcmath \
    intl \
    mbstring \
    opcache \
    pdo_mysql \
  && rm -rf /var/cache/apk/*

COPY --from=backend-builder /app/backend /var/www/backend
COPY --from=frontend-builder /app/frontend/dist /var/www/frontend/dist

COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/php-fpm-env.conf /usr/local/etc/php-fpm.d/zz-env.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh \
  && mkdir -p /run/nginx /var/log/supervisor \
  && chown -R www-data:www-data /var/www/backend/storage /var/www/backend/bootstrap/cache

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
