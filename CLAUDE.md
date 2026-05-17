# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Next.js 16 — read before writing code

This repo runs **Next.js 16.2.4 + React 19.2 + Prisma 7**. APIs, conventions, and file layout differ from your training data. Before writing or editing Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. Heed deprecation notices.

Specific traps:
- **No `middleware.ts`** — it has been renamed to `proxy.ts` (see [src/proxy.ts](src/proxy.ts)) using `NextAuth(authConfig)` from the edge-safe `auth.config.ts`.
- **Prisma 7 datasource URL** is set in [prisma.config.ts](prisma.config.ts) (`datasource.url`), NOT in `schema.prisma`.
- **Prisma client output** goes to `src/generated/prisma` (gitignored). Always import from `@/generated/prisma` (or `@/lib/prisma` for the singleton), never `@prisma/client`.
- **NextAuth v5 beta** (`next-auth@5.0.0-beta.31`) with the JWT strategy; the PrismaAdapter is cast because it type-checks against the legacy `@prisma/client` shape — runtime is fine, do not rewrite.

## Working directory

The actual app lives in the **`e-formationgn/`** subdirectory. The sibling `../prisma/` and `../src/` folders at the workspace root are leftovers — ignore them. Run all commands from `e-formationgn/`.

## Commands

```bash
npm run dev              # next dev (port 3000)
npm run build            # next build (standalone output for Docker)
npm run start            # next start (after build)
npm run lint             # eslint
npm run typecheck        # tsc --noEmit
npm run test:e2e         # playwright test (requires a running dev server on :3000)
npm run db:seed          # tsx prisma/seed.ts — idempotent: 8 cats, 1 demo instructor, 4 courses
npm run check:payments   # tsx scripts/check-payments.ts — sanity-check payment config
npm run db:migrate:deploy

# Prisma — note: URL comes from prisma.config.ts, not schema.prisma
npx prisma generate
npx prisma migrate dev --name <slug>
npx prisma studio

# Single Playwright test
npx playwright test tests/e2e/security.spec.ts -g "rate-limit"

# Stripe webhooks in local dev
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
```

Playwright does **not** auto-start the dev server (intentional, see [playwright.config.ts](playwright.config.ts)) — start `npm run dev` first.

## Architecture

### Two-tier NextAuth config (edge vs node)

This is the most load-bearing pattern in the codebase and a frequent source of bugs:

- **[src/auth.config.ts](src/auth.config.ts)** — *edge-safe*. NO Prisma, NO bcrypt, NO Node-only imports. Consumed by [src/proxy.ts](src/proxy.ts) (Next.js 16 proxy/middleware) to gate routes. The `session()` callback here only copies fields from JWT — without it, route guards in the edge see every user as `STUDENT` and break role checks.
- **[src/auth.ts](src/auth.ts)** — Node runtime. Extends `authConfig` with `PrismaAdapter`, `Credentials` provider, and the full `jwt()`/`session()` callbacks that hit Postgres for session revocation, impersonation, etc.

Never import `@/auth` from edge code (proxy, middleware-like contexts). Anything edge-touched goes through `@/auth.config`.

### Route protection lives in `authConfig.callbacks.authorized`

All RBAC routing decisions (redirect to `/connexion`, role-gate `/admin/*` and `/formateur/*`, allow webhooks/cron/public APIs) are concentrated in one `authorized` callback in [src/auth.config.ts](src/auth.config.ts). When adding a new route, check whether it needs an explicit allow-list entry (webhooks, cron, certificate verifier, etc.) before any other security work.

### Server Actions over API routes

Mutations are **Server Actions** in [src/server/actions/](src/server/actions/), not API routes. API routes under [src/app/api/](src/app/api/) are reserved for:
- `webhooks/{stripe,mux,cinetpay}` — signature-verified IPNs
- `auth/[...nextauth]` — NextAuth handler
- `cron/cleanup` — Bearer-token-protected scheduled jobs
- `health`, `recherche` (search autocomplete), `track` (analytics), `certificats/[serial]`, `upload/course-thumbnail`, `admin/search`

Reads (catalog, dashboard data, etc.) go in [src/server/queries/](src/server/queries/). Longer-running orchestrations live in [src/server/services/](src/server/services/) (e.g. `pricing-engine.ts`, `email-campaign.ts`).

Every sensitive Server Action must:
1. Call a helper from [src/lib/auth/authorization.ts](src/lib/auth/authorization.ts) — `requireSession`, `requireAdmin`, `requireAnyAdminRole(...)`, `requireInstructorOrAdmin`, `requireCourseOwnership`, etc.
2. Validate input with Zod (`.strict()`) from [src/lib/validators/](src/lib/validators/).
3. Never trust commission rates / prices from the client — recompute server-side via [src/lib/commission.ts](src/lib/commission.ts) and snapshot onto the `OrderItem`.

### Payments: dual-PSP by currency

| Currency | PSP | Modes |
|---|---|---|
| EUR / USD | **Stripe Checkout** (+ Stripe Connect Express, separate charges and transfers) | Card, Apple/Google Pay |
| GNF / XOF | **CinetPay** | Mobile Money (Orange/MTN/Moov), local cards |

`Order.totalCents` stores **minor units** — for GNF/XOF (no subdivision) that means whole units. Always use the helpers in [src/lib/payments/currency.ts](src/lib/payments/currency.ts) (`amountToMinor`, `minorToAmount`, `currencyMinorMultiplier`). Course prices are stored as 4 separate columns (`priceEUR`/`priceUSD`/`priceGNF`/`priceXOF`) — there is no FX conversion at runtime. See [PAYMENTS.md](PAYMENTS.md).

CinetPay IPN handling: **always re-verify** via `checkTransaction()` after signature check — never trust the IPN payload alone.

### RBAC: 6 roles, hierarchical

`STUDENT`, `INSTRUCTOR`, `ADMIN`, plus admin sub-roles `MODERATOR`, `SUPPORT`, `FINANCE`. The set of "admin-flavoured" roles is [src/lib/constants.ts](src/lib/constants.ts) `ADMIN_ROLES` — use that everywhere, don't hardcode role lists.

`internalNotes` on the User/Course is admin-only and must be omitted via Prisma `omit:` when the viewer is not admin (see `getInstructorCourse()`).

### Auth hardening worth knowing about

- `User.passwordChangedAt` is checked in [src/auth.ts](src/auth.ts) JWT callback — any token with `iat < passwordChangedAt` is invalidated. This is how "log out all sessions" works after a password reset.
- Login attempts go through [src/lib/auth/login-attempts.ts](src/lib/auth/login-attempts.ts) with email-based lockout (5 fails / 15 min). IPs are stored as `sha256(ip + secret)`.
- `fakeVerifyPassword()` burns bcrypt CPU on missing users to flatten timing-based email enumeration.
- New passwords are checked against HaveIBeenPwned (k-anonymity, degrades gracefully).
- Admin impersonation flows through a signed cookie read in the `session()` callback — `session.impersonation` carries the real admin ID.

### Database / Prisma 7 specifics

- 28 models, 14 enums in [prisma/schema.prisma](prisma/schema.prisma).
- Migrations are baselined: `0_init` is the starting point. Existing databases that were synced via `db push` must be marked applied (`prisma migrate resolve --applied 0_init …`) before `migrate deploy`.
- The Prisma client is generated to `src/generated/prisma/` (configured via `generator client { output = "../src/generated/prisma" }`). The [src/lib/prisma.ts](src/lib/prisma.ts) singleton wraps it with `@prisma/adapter-pg` and reuses the connection across hot reloads in dev.

### i18n / locale

UI strings are **French only** (`Locale.FR`). The framework for multi-locale (`src/lib/i18n/`) is in place but not currently exercised. Identifiers stay in English.

### Rate-limiting

In-memory `Map`-based limiter in [src/lib/rate-limit.ts](src/lib/rate-limit.ts) — correct for the single-process Docker deployment. If scaling out, swap for Upstash Redis (the call sites are centralized).

### Storage

Course thumbnails / instructor uploads use Cloudflare R2 ([src/lib/storage/r2.ts](src/lib/storage/r2.ts) — S3-compatible). Mux handles video (direct upload + asset/upload helpers in [src/lib/mux.ts](src/lib/mux.ts)). `next.config.ts` sets `images.unoptimized: true` because thumbnails can come from arbitrary instructor-provided URLs — don't reintroduce an `images.remotePatterns` allow-list without coordinating.

## Conventions enforced by the codebase

- TypeScript **strict**, no `any`.
- **Server Components by default**; only add `"use client"` when interactivity demands it.
- All mutations via Server Actions; all input validated with Zod `.strict()`.
- UI text in French; code identifiers in English.
- Commissions computed server-side only; never accept a rate from the client.
- `AuditLog` on every admin-impactful action (`course.approve`, `commission.update`, etc.).

## Deployment

- **Hostinger VPS via Docker Compose** is the production target (see [DEPLOY.md](DEPLOY.md), [docker-compose.yml](docker-compose.yml), [Dockerfile](Dockerfile)). Multi-stage build → standalone Next.js output; entrypoint runs `prisma migrate deploy` then `node server.js`.
- A **Vercel** path also works (see [README.md](README.md)) — set the build command to `prisma migrate deploy && next build`.
- Healthcheck: `GET /api/health` → 200 (or 503 if DB is unreachable).
- CSP is currently `Report-Only` in [next.config.ts](next.config.ts); the long-standing TODO is to flip to enforce after 48h of clean reports in prod.

## Demo accounts

After `npm run db:seed`:
- Instructor: `formateur@e-formationgn.com` / `Demo1234!` (affiliate code `awa-diallo`)
- Promote yourself to admin via SQL: `UPDATE "User" SET role = 'ADMIN' WHERE email = '…';`

## Reference docs in-repo

- [README.md](README.md) — full setup, routes, env vars
- [SECURITY.md](SECURITY.md) — threat model, controls, residual CVEs
- [PAYMENTS.md](PAYMENTS.md) / [PAYMENTS-TEST.md](PAYMENTS-TEST.md) — Stripe + CinetPay flows
- [DEPLOY.md](DEPLOY.md) / [REDEPLOY.md](REDEPLOY.md) — VPS deployment
- [BRAND.md](BRAND.md) — color tokens, voice, dark-mode rules
