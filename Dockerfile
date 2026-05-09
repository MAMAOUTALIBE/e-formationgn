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
# Variables factices pour le build : Next.js exécute du code serveur
# (genre `import "server-only"`) qui peut tenter de lire env. Les vraies
# valeurs seront injectées au runtime par docker-compose.
ENV DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder?schema=public"
ENV NEXTAUTH_SECRET="build_only_placeholder_secret_at_least_32_chars_long"
ENV NEXTAUTH_URL="https://placeholder.local"
ENV NEXT_PUBLIC_APP_URL="https://placeholder.local"

RUN npx prisma generate
RUN npm run build

# ---------- 4. runner : image finale ----------
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl curl tini \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

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

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]
CMD ["node", "server.js"]
