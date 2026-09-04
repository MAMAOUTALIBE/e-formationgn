# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Next.js 16 — read before writing code

This repo runs **Next.js 16.2.6 + React 19.2 + Prisma 7**. APIs, conventions, and file layout differ from your training data. Before writing or editing Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. Heed deprecation notices.

Specific traps:
- **No `middleware.ts`** — it has been renamed to `proxy.ts` (see [src/proxy.ts](src/proxy.ts)) using `NextAuth(authConfig)` from the edge-safe `auth.config.ts`.
- **Prisma 7 datasource URL** is set in [prisma.config.ts](prisma.config.ts) (`datasource.url`), NOT in `schema.prisma`.
- **Prisma client output** goes to `src/generated/prisma` (gitignored). Always import from `@/generated/prisma` (or `@/lib/prisma` for the singleton), never `@prisma/client`.
- **NextAuth v5 beta** (`next-auth@5.0.0-beta.31`) with the JWT strategy; the PrismaAdapter is cast because it type-checks against the legacy `@prisma/client` shape — runtime is fine, do not rewrite.

## Commands

```bash
npm run dev              # next dev (port 3000)
npm run build            # next build (standalone output for Docker)
npm run start            # next start (after build)
npm run lint             # eslint
npm run typecheck        # tsc --noEmit
npm run test:e2e         # playwright test (requires a running dev server on :3000)
npm run test:e2e:install # one-time: install the Chromium browser for Playwright
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

### Payments: **disabled platform-wide** — read this before touching commerce code

The whole financial surface is switched off, in two places at once:

- `src/proxy.ts` — `REMOVED_PAGES` returns **404** for `/panier`, `/commande`,
  `/admin/finances/*`, `/admin/commissions`, promo codes, affiliation,
  `/formateur/paiements`, `/admin/support/litiges`, …, and `REMOVED_APIS`
  returns **410** for `/api/webhooks/{stripe,cinetpay}`, `/api/formateur/ventes`,
  `/api/admin/transactions-csv` and the reconciliation crons.
- `src/lib/platform-mode.ts` — `getPlatformMode()` returns `"centre_formation"`
  **hard-coded**; it does not read `PLATFORM_MODE`. Self-registration is closed
  and refused server-side in `registerUser`.

The code below still exists but is **dormant** — kept so the mode can be
reverted without demolishing the order tunnel. Two consequences when working
here: a page under a removed route is unreachable, so a link added to it is a
dead link (`tests/unit/removed-pages-links.test.ts` and
`tests/e2e/rbac-roles.spec.ts` enforce that); and `PLATFORM_MODE` /
`NEXT_PUBLIC_PLATFORM_MODE` remain required by `scripts/deploy.sh` and
`scripts/validate-production-env.sh`, which demand they match — they gate the
deploy even though the runtime ignores them.

#### Dormant design: dual-PSP by currency

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
- Login and registration are gated by **Cloudflare Turnstile** ([src/lib/auth/turnstile.ts](src/lib/auth/turnstile.ts)) — the token is verified server-side in the auth Server Actions; verification degrades gracefully (allows through) when no Turnstile keys are configured.

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

### AI features (Groq)

[src/lib/ai/](src/lib/ai/) holds seven independent Groq-backed helpers — `lesson-summary`, `quiz-generator`, `seo-suggestions`, `review-moderation`, `tutor`, `admin-assistant` and `assistant`. Production model IDs are centralized in [src/lib/ai/models.ts](src/lib/ai/models.ts) and the SDK client plus response parsers in [src/lib/ai/client.ts](src/lib/ai/client.ts) (`getGroqClient`) — do not re-declare either. All share the same contract: a single `GROQ_API_KEY` env var, an `isXxxConfigured()` guard, and **graceful degradation** when the key is absent (the feature is simply skipped, never throws). When adding an AI feature, follow that pattern — never make a code path hard-depend on the AI being configured.

### Aiduca-IA (public assistant)

`assistant` is the public-facing one, and the only feature that answers **visitors**. It is grounded by construction rather than by prompting alone:

1. Retrieval is deterministic and happens *before* the model call — [src/server/queries/assistant.ts](src/server/queries/assistant.ts) is the single place that decides what the model may see. It never selects `internalNotes`, prices, or learner data, and reads only published rows. The model has **no tools**: it cannot fetch anything it wasn't shown.
2. The model fills a forced tool (`repondre`) rather than writing free text, and its output is re-checked against the retrieved context by `normalizeAssistantAnswer` in [src/lib/assistant/contract.ts](src/lib/assistant/contract.ts) — a hallucinated course slug is dropped before it can become a button, and any certainty below `CERTAINE` forces the "contact an advisor" path and flags the question in `/admin/assistant/questions`.
3. **Never let it quote a price.** The platform is in `centre_formation` mode: no price is displayed anywhere and there is no checkout. The seeded knowledge base states this explicitly; `tests/unit/assistant-safety.test.ts` enforces that the price columns stay out of the retrieval layer.

Retrieval uses Postgres French full-text search over `AssistantChunk.searchVector` (trigger + GIN, same pattern as `Course.searchVector`). Unlike the catalogue search it ORs the query lexemes instead of ANDing them — a natural-language question rarely has every one of its words in the answer. Documents are managed at `/admin/assistant/sources` and seeded from the site's own content with the “Synchroniser le site” action or `npm run assistant:seed` (idempotent; both only overwrite the `auto-` prefixed documents they created).

## Conventions enforced by the codebase

- TypeScript **strict**, no `any`.
- **Server Components by default**; only add `"use client"` when interactivity demands it.
- All mutations via Server Actions; all input validated with Zod `.strict()`.
- UI text in French; code identifiers in English.
- Commissions computed server-side only; never accept a rate from the client.
- `AuditLog` on every admin-impactful action (`course.approve`, `commission.update`, etc.).

## Deployment

Production is **live at https://gandal.org** on a Hostinger VPS. [REDEPLOY.md](REDEPLOY.md) is the source of truth for the redeploy procedure.

- **Orchestration:** Docker Compose project `eformationgn` at `/docker/e-formationgn/` on the VPS — `db` + `app` + `cron`. [docker-compose.yml](docker-compose.yml) in the repo is the prod config.
- **Image:** built on the Mac (`linux/amd64`) and pushed to Docker Hub `bahm2062/e-formationgn` via `npm run deploy` ([scripts/deploy.sh](scripts/deploy.sh)). The VPS only `docker compose pull`s — it never builds.
- **Reverse proxy:** the VPS's shared Traefik (`traefik-zcbs`), wired via Traefik labels on the `app` service. **No Caddy** — older revisions of the compose shipped Caddy; it was dropped because Traefik already owns ports 80/443.
- Multi-stage [Dockerfile](Dockerfile) → standalone Next.js; the entrypoint runs `prisma migrate deploy` then `node server.js`, so **migrations auto-apply on every redeploy**.
- The Postgres password **must be URL-safe (hex)** — a base64 password (`+`/`/`) breaks the runtime `@prisma/adapter-pg` connection-string parser even though `prisma migrate deploy` tolerates it.
- Healthcheck: `GET /api/health` → 200 (or 503 if DB is unreachable).
- [DEPLOY.md](DEPLOY.md) documents the original from-scratch install (with Caddy) — partly historical; trust REDEPLOY.md for current reality.
- CSP **is enforced**: `next.config.ts` defaults `CSP_MODE` to `enforce`, and the value now travels to the image as a Docker build-arg (`Dockerfile` + `scripts/deploy.sh`). It is a **build-time** setting — Next bakes the header into `routes-manifest.json`, so changing it in the VPS `.env` and restarting does nothing; rebuild the image.

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
