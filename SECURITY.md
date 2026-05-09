# Sécurité — E-FormationGN

Cette page documente les protections en place et les hypothèses de menace
adressées. Toute modification structurante (auth, sessions, validation)
doit mettre à jour ce document.

## Modèle de menace

Acteurs considérés :
- **Internet anonyme** (scrapers, bots, scanners CVE)
- **Utilisateur authentifié malveillant** (essai d'élévation de privilèges)
- **Formateur malveillant** (essai d'accès aux cours d'autrui)
- **Admin compromis** (par fuite mot de passe ou jeton)

Hors-périmètre :
- Attaques au niveau infra (DDoS volumétrique → relégué au reverse-proxy
  Hostinger / Caddy / CDN)
- Attaques sur la chaîne d'approvisionnement npm (mitigation : `npm audit`,
  Renovate / Dependabot recommandé en CI)

## Authentification

| Contrôle | Implémentation |
|---|---|
| Hash mot de passe | bcrypt cost 12 ([password.ts](src/lib/auth/password.ts)) |
| JWT signé | NEXTAUTH_SECRET ≥ 32 chars (validé Zod au boot, [env.ts](src/lib/env.ts)) |
| Anti-énumération login | `fakeVerifyPassword()` brûle CPU si user inexistant — timing constant |
| Anti-énumération reset | Idem côté `requestPasswordReset` |
| Rate-limit login (IP) | 10 essais / 15 min ([auth.ts](src/server/actions/auth.ts)) |
| Rate-limit register (IP) | 5 / heure |
| Rate-limit reset request (IP) | 5 / heure |
| Rate-limit reset confirm (IP) | 10 / 15 min |
| Rate-limit resend verify (IP) | 5 / heure |
| **Account lockout (email)** | 5 échecs sur 15 min → blocage jusqu'à expiration de la fenêtre ([login-attempts.ts](src/lib/auth/login-attempts.ts)) |
| **HaveIBeenPwned check** | Refus à l'inscription / reset si mot de passe vu dans une fuite publique. K-anonymity (5 premiers chars de SHA-1 envoyés). Dégrade gracieusement si l'API HIBP est down. ([pwned-passwords.ts](src/lib/auth/pwned-passwords.ts)) |
| **Révocation sessions** | `User.passwordChangedAt` > `token.iat` → JWT invalide ([auth.ts](src/auth.ts)) |
| Vérouillage statut | `status === "SUSPENDED" / "DELETED"` → JWT invalide |
| LoginAttempt audit | Persisté pour chaque tentative (succès/échec) — visible sur `/admin/securite/logs` |
| Email verify | Requise avant login (sauf OAuth Google qui pré-vérifie) |
| Reset token | Single-use, expiry, usedAt set lors de l'usage |

## Autorisation (RBAC)

6 rôles (`STUDENT`, `INSTRUCTOR`, `ADMIN`, `MODERATOR`, `SUPPORT`,
`FINANCE`) — cf. [constants.ts](src/lib/constants.ts).

Helpers centralisés : [authorization.ts](src/lib/auth/authorization.ts)

- `requireSession()` — throw si anonyme
- `requireAdmin()` — strict (pas de sous-rôle CRM)
- `requireAnyAdminRole(...allowed)` — filtre fin (FINANCE, MODERATOR, SUPPORT)
- `requireInstructorOrAdmin()` — espace formateur
- `requireCourseOwnership` / `requireSectionOwnership` / `requireLessonOwnership`

Toutes les Server Actions critiques :
1. Appellent une de ces fonctions avant la mutation
2. Lèvent `AuthorizationError` typé (UNAUTHENTICATED / FORBIDDEN / NOT_FOUND)

`internalNotes` (notes admin de modération) : exclu de
`getInstructorCourse()` via `omit:` Prisma quand le viewer n'est pas admin.

## Validation des entrées

- **Zod systématique** sur Server Actions (`.strict()` activé partout)
- **Webhook signatures** validées :
  - Stripe : `stripe.webhooks.constructEventAsync(body, sig, secret)`
  - Mux : `mux.webhooks.unwrap(body, headers)`
- **Cron `/api/cron/cleanup`** : `Authorization: Bearer ${CRON_SECRET}`
- **safeCallbackUrl** : ferme l'open-redirect (path-only, pas de //evil)

## Rate-limiting général

In-memory (Map) — voir [rate-limit.ts](src/lib/rate-limit.ts). Suffisant
pour un seul process (déploiement Docker Hostinger). Pour scale-out :
remplacer par Upstash Redis.

Endpoints / actions protégées (en plus de l'auth) :
- `/api/recherche` (60 / min IP)
- `/api/admin/search` (60 / min IP+user)
- `cart.addCourseToCart` (60 / min user)
- `qa.createQuestion` (20 / heure user)
- `qa.answerQuestion` (60 / heure user)
- `reviews.upsertReview` (30 / jour user)
- `tutor.askLessonTutor` (10 / heure user)
- `ai-seo.suggestSeoForCourse` (5 / heure user)
- `ai-lesson-summary.regenerateLessonSummary` (10 / heure user)
- `ai-quiz.generateQuizQuestionsForLesson` (5 / heure user)

## En-têtes HTTP

[next.config.ts](next.config.ts) applique sur toutes les pages :
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self)`
- `Content-Security-Policy-Report-Only` (whitelist Stripe / Mux / Sentry / R2)

API sensibles (`/api/admin/search`) : `Cache-Control: private, no-store, max-age=0`

## Données sensibles

- Mots de passe : jamais loggués, jamais dans les responses (Prisma select
  exclut `hashedPassword` partout sauf en local pour bcrypt.compare)
- Stripe `accountId` / Mux secrets : jamais exposés au client
- Cookies : HttpOnly + Secure (en prod, gérés par NextAuth)
- IP : hashée (sha-256 + secret) avant stockage (`LoginAttempt.ipHash`)
- LOG : Sentry route les erreurs serveur ; pas de mot de passe / secret
  dans les payloads (vérifié manuellement)

## Observabilité

- **Sentry** (server, client, edge) : init via `instrumentation.ts`,
  captureException sur tous les `console.error/warn` critiques
- **AuditLog** : actions sensibles loggées (course publish, dispute,
  payout, review.auto_unpublished, etc.)
- **LoginAttempt** : visible sur `/admin/securite/logs`

## Tests E2E sécurité

[tests/e2e/security.spec.ts](tests/e2e/security.spec.ts) — exécuté via
`npm run test:e2e` :
- Rate-limit /api/recherche → 429 après ~60 req
- callbackUrl externe / `//evil` → ne suit pas
- /api/admin/search anonyme → 403 + `Cache-Control: no-store`
- Webhooks /api/webhooks/{stripe,mux} sans signature → 400 ou 503
- /api/cron/cleanup sans bearer ou avec mauvais bearer → 401

## CVE résiduelles connues

`npm audit --omit=dev` : 7 CVE moderate dans la chaîne tooling
(prisma → @prisma/dev → hono ; next → postcss). **Non exploitables
en production** : ces packages servent au build (postcss) ou à Prisma
Studio (hono), jamais dans le runtime servi au public. À résoudre quand
les upstreams patcheront sans rupture API. Tracking :
- `npm audit fix --force` proposerait des breaking changes (downgrades
  Prisma 6, Next 9) — refusé.

## Hardening recommandé (post-MVP)

- [ ] **2FA / TOTP** pour les comptes admin (perte mot de passe = compte volé)
- [ ] **Notification de connexion depuis nouveau device/IP** (email)
- [ ] **CSP en mode `enforce`** (actuellement `report-only`) après 48 h
  sans violation observée
- [ ] **Rotate `NEXTAUTH_SECRET`** tous les 6-12 mois
  (déconnecte tous les utilisateurs — communiquer)
- [ ] **Backup chiffré** des dumps Postgres (cf. cron Hostinger DEPLOY.md)
- [ ] **Rate-limit distribué** (Redis) si passage en multi-instance
- [ ] **WAF** (Cloudflare ou Hostinger) pour bloquer les patterns
  d'injection au niveau edge
- [ ] **Session expiry adaptive** (raccourcir TTL pour rôles ADMIN)

## Reporting d'une faille

Pour rapporter une vulnérabilité, contacter `contact@gmd2025.org`. Ne
divulguez pas publiquement avant correctif.
