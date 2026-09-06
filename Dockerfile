# syntax=docker/dockerfile:1.7
# E-FormationGN — image Docker production (Next.js 16 standalone + Prisma 7)
# Multi-stage : deps → builder → runner. Image finale ~180 MB.

# ---------- 1. deps : toutes les dépendances (dev + prod) pour le build ----------
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ---------- 2. prod-deps : production-only, pour le runtime + Prisma CLI ----------
# Contient prisma + @prisma/config + transitive deps (effect, c12, etc.) que
# `prisma migrate deploy` exige au démarrage. Le standalone Next.js ne curate
# que ce que l'app importe directement, donc on ne peut pas s'y fier ici.
FROM node:20-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev --no-audit --no-fund

# ---------- 3. builder : build Next.js ----------
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Plafond de tas explicite. Sans lui, Node dimensionne son tas d'après la
# mémoire vue dans le conteneur et peut réclamer plus que ce que la VM Docker
# peut donner — le noyau tue alors le processus (SIGKILL) au lieu de laisser V8
# déclencher un ramasse-miettes. Complète `experimental.cpus` dans
# next.config.ts, qui limite le NOMBRE de workers ; ici on borne CHACUN.
ENV NODE_OPTIONS="--max-old-space-size=1536"
# Variables factices pour le build : Next.js exécute du code serveur
# (genre `import "server-only"`) qui peut tenter de lire env. Les vraies
# valeurs seront injectées au runtime par docker-compose.
ENV DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder?schema=public"
ENV NEXTAUTH_SECRET="build_only_placeholder_secret_at_least_32_chars_long"
ENV NEXTAUTH_URL="https://placeholder.local"
# Variables NEXT_PUBLIC_* : Next.js les fige DANS LE BUNDLE au moment du build,
# pas au démarrage du conteneur. Les poser seulement dans docker-compose est
# sans effet — c'est ce qui avait silencieusement désactivé Turnstile et rempli
# le sitemap de « placeholder.local » en production. Elles doivent donc entrer
# ici, par --build-arg (scripts/deploy.sh les lit dans .env).
# Nombre de workers de génération statique. Vaut 1 par défaut — la valeur qui
# rend la construction possible sur un Mac 8 Go sous émulation. Un runner
# x86_64 natif passe 4 et divise la durée par dix. Cf. la note dans
# next.config.ts.
ARG NEXT_BUILD_WORKERS=1
ENV NEXT_BUILD_WORKERS=${NEXT_BUILD_WORKERS}

ARG NEXT_PUBLIC_APP_URL="https://placeholder.local"
ARG NEXT_PUBLIC_APP_NAME="Gandal"
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=""
ARG NEXT_PUBLIC_SENTRY_DSN=""
ARG NEXT_PUBLIC_PLATFORM_MODE="marketplace"
# CSP_MODE relève du même piège que les NEXT_PUBLIC_* : `next.config.ts`
# construit l'en-tête pendant `next build`, et Next le fige dans
# `routes-manifest.json`. Le poser dans docker-compose ou dans le `.env` du VPS
# ne change donc rien à l'en-tête servi — alors que `.env.production.example`
# le déclare et que `validate-production-env.sh` le contrôle comme une variable
# d'exécution. Sans cette ligne, basculer la CSP en report-only pour un
# diagnostic n'avait aucun effet, et un build fait avec report-only aurait servi
# une CSP inopérante qu'aucun réglage sur le serveur n'aurait pu corriger.
ARG CSP_MODE="enforce"
ENV CSP_MODE=${CSP_MODE}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=${NEXT_PUBLIC_TURNSTILE_SITE_KEY}
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
ENV NEXT_PUBLIC_PLATFORM_MODE=${NEXT_PUBLIC_PLATFORM_MODE}

RUN npx prisma generate
# Turbopack sous émulation linux/amd64 sur Mac ARM conserve un pic mémoire
# important pendant la collecte finale des traces, même avec un seul worker.
# Webpack produit le même standalone Next.js et reste sous l'enveloppe Docker.
RUN npx next build --webpack

# ---------- 4. runner : image finale ----------
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache \
    openssl curl tini su-exec \
    libreoffice poppler-utils \
    font-dejavu font-liberation font-noto \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /app/private-uploads \
  && chown nextjs:nodejs /app/private-uploads

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV PRIVATE_UPLOAD_ROOT=/app/private-uploads

# Sortie standalone : server.js + node_modules curatés pour le runtime
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# node_modules production complet — écrase le node_modules du standalone par
# un superset qui contient prisma CLI + toutes ses transitive deps (effect…).
# Indispensable pour `prisma migrate deploy` au démarrage.
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Schema + migrations Prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

# Entrypoint : lance migrate deploy puis le serveur
COPY --chown=nextjs:nodejs scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]
CMD ["node", "server.js"]
