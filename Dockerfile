# syntax=docker/dockerfile:1.7

# The Node 24 builder manifest was checked through Docker Hub on 2026-11-04.
FROM node:24-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c AS frontend-build
WORKDIR /build

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm ci --ignore-scripts

COPY frontend frontend
RUN npm run build --workspace frontend

# Exact Composer release; digest still needs pinning from a networked Docker host.
FROM composer:2.11.1 AS composer

# PHP 8.3 matches backend/composer.json; digest still needs pinning from a networked Docker host.
FROM php:8.3-cli-bookworm AS production

RUN apt-get update \
    && apt-get install --no-install-recommends -y libonig-dev libsqlite3-dev \
    && docker-php-ext-install mbstring pdo_sqlite \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 expensedesk \
    && useradd --uid 10001 --gid expensedesk --home-dir /app --shell /usr/sbin/nologin expensedesk

WORKDIR /app

COPY --from=composer /usr/bin/composer /usr/local/bin/composer
COPY backend/composer.json backend/composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --no-progress \
    --prefer-dist \
    --classmap-authoritative \
    --no-scripts

COPY backend ./
COPY --from=frontend-build /build/frontend/dist ./public

RUN composer dump-autoload --no-dev --classmap-authoritative --no-interaction \
    && mkdir -p \
        /var/lib/expensedesk \
        storage/app/receipts \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/views \
        storage/logs \
        bootstrap/cache \
    && chown -R expensedesk:expensedesk /app /var/lib/expensedesk

ENV APP_ENV=production \
    APP_DEBUG=false \
    DB_CONNECTION=sqlite \
    DB_DATABASE=/var/lib/expensedesk/database.sqlite \
    DB_FOREIGN_KEYS=true \
    SESSION_DRIVER=database \
    SESSION_SECURE_COOKIE=true \
    CACHE_STORE=database \
    LOG_CHANNEL=stderr

USER 10001:10001
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD php -r '$response = @file_get_contents("http://127.0.0.1:8000/api/health"); exit($response !== false && str_contains($response, "\"status\":\"ok\"") ? 0 : 1);'

# Laravel requires the configured SQLite file to exist before it can open the
# connection. Create it only on a fresh persistent volume, then leave it intact
# across every later restart. The production entrypoint never invokes a seeder.
CMD ["sh", "-c", "umask 077 && (test -f \"$DB_DATABASE\" || touch \"$DB_DATABASE\") && php artisan migrate --force && php artisan expensedesk:first-admin && exec php artisan serve --host=0.0.0.0 --port=8000"]
