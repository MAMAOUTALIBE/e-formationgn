# E-FormationGN

Marketplace francophone de formation en ligne (multi-formateurs), inspirée
d'Udemy / LinkedIn Learning. Trois rôles : **élève**, **formateur**,
**administrateur**.

> **État : v1 complète.** Toutes les phases sont livrées : authentification,
> catalogue, espace formateur (édition + Mux), paiements (Stripe + Connect),
> apprentissage (player vidéo, progression, quiz, certificats PDF),
> engagement (avis, Q&A, wishlist, notifications), administration et SEO.

---

## Stack technique

| Domaine | Choix |
| --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript strict |
| Styling | Tailwind CSS v4 (CSS-first config) |
| Composants | shadcn/ui-style + Radix + Lucide |
| Base de données | PostgreSQL (Supabase) |
| ORM | Prisma 7 (`prisma-client` generator + adapter `@prisma/adapter-pg`) |
| Authentification | NextAuth.js v5 (Auth.js) — JWT + PrismaAdapter + Google OAuth |
| Paiements | Stripe Checkout + Stripe Connect (Express, *separate charges and transfers*) |
| Vidéo | Mux (direct upload + Mux Player + webhook) |
| Emails | Resend (avec mode stub si pas de clé) |
| Recherche | LIKE Postgres (insensible à la casse) |
| Formulaires | React Hook Form + Zod |
| État client | Zustand (réservé à l'usage futur) |
| Hébergement | Vercel |
| PDF | pdf-lib (certificats brandés) |

---

## Routes

**Public :**
`/` · `/cours` · `/cours/[slug]` · `/cours/[slug]/questions` · `/cours/[slug]/questions/[questionId]` · `/categories` · `/categories/[slug]` · `/devenir-formateur` · `/certificat/[serial]` · `/cgv` · `/mentions-legales` · `/confidentialite` · `/cookies` · `/a-propos` · `/contact` · `/sitemap.xml` · `/robots.txt`

**Authentification :**
`/connexion` · `/inscription` · `/mot-de-passe-oublie` · `/reinitialiser-mot-de-passe` · `/verifier-email`

**Élève (connecté) :**
`/profil` · `/panier` · `/commande/[id]/confirmation` · `/apprentissage` · `/apprentissage/[slug]` · `/apprentissage/[slug]/lecons/[lessonId]` · `/wishlist` · `/notifications`

**Formateur (rôle INSTRUCTOR) :**
`/formateur` · `/formateur/cours` · `/formateur/cours/nouveau` · `/formateur/cours/[id]` · `/formateur/cours/[id]/programme` · `/formateur/cours/[id]/tarification` · `/formateur/cours/[id]/seo` · `/formateur/cours/[id]/lecons/[lessonId]` · `/formateur/paiements`

**Administrateur (rôle ADMIN) :**
`/admin` · `/admin/cours` · `/admin/cours/[id]` · `/admin/utilisateurs` · `/admin/categories` · `/admin/commissions` · `/admin/codes-promo` · `/admin/cms`

**APIs :**
`/api/auth/[...nextauth]` · `/api/webhooks/mux` · `/api/webhooks/stripe` · `/api/certificats/[serial]`

---

## Pré-requis

- Node.js ≥ 20
- npm ≥ 10
- (Pour Mux/Stripe) `stripe-cli` pour tester les webhooks en local

---

## Installation

```bash
cd e-formationgn
npm install
cp .env.example .env       # éditer avec vos clés (cf. ci-dessous)
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed            # crée 8 catégories, 1 formateur démo, 4 cours
npm run dev
```

Ouvrir http://localhost:3000.

---

## Variables d'environnement (`.env`)

| Clé | Obligatoire | Source |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Supabase → Settings → Database (pooler 6543) |
| `DIRECT_URL` | ✅ | Supabase (port 5432, pour migrations) |
| `NEXTAUTH_URL` | ✅ | `http://localhost:3000` en dev, votre domaine en prod |
| `NEXTAUTH_SECRET` | ✅ | `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | ✅ | URL publique (utilisée dans les emails, le sitemap, etc.) |
| `GOOGLE_CLIENT_ID/SECRET` | optionnel | Google Cloud → Credentials → OAuth 2.0 |
| `STRIPE_SECRET_KEY` | pour les paiements | Stripe Dashboard → Developers |
| `STRIPE_WEBHOOK_SECRET` | pour les webhooks | `stripe listen --forward-to ...` ou Dashboard |
| `MUX_TOKEN_ID/SECRET` | pour la vidéo | Mux → Settings → Access Tokens |
| `MUX_WEBHOOK_SECRET` | pour les webhooks | Mux → Settings → Webhooks |
| `RESEND_API_KEY` | optionnel | Resend → API Keys (mode stub si absent) |
| `RESEND_FROM_EMAIL` | optionnel | Email vérifié dans Resend |
| `ANTHROPIC_API_KEY` | pour les fonctions IA | Anthropic Console → API Keys (le widget Aiduca-IA reste masqué si absent) |
| `PLATFORM_COMMISSION_INSTRUCTOR_BPS` | optionnel | Défaut 1500 (15 %) |
| `PLATFORM_COMMISSION_PLATFORM_BPS` | optionnel | Défaut 3000 (30 %) |

---

## Comptes externes à créer

| # | Service | Pourquoi | URL |
| - | --- | --- | --- |
| 1 | **Supabase** | Base PostgreSQL | https://supabase.com |
| 2 | **Resend** | Emails transactionnels | https://resend.com |
| 3 | **Google Cloud Console** | OAuth « Continuer avec Google » | https://console.cloud.google.com |
| 4 | **Mux** | Hébergement & streaming vidéo | https://mux.com |
| 5 | **Stripe** | Paiements + Stripe Connect | https://dashboard.stripe.com |
| 6 | **Vercel** | Hébergement de production | https://vercel.com |
| 7 | **Registrar** | Domaine `e-formationgn.com` | Cloudflare Registrar / Namecheap / OVH |

---

## Commandes utiles

| Commande | Description |
| --- | --- |
| `npm run dev` | Serveur Next.js (HMR) |
| `npm run build` | Build de production |
| `npm run start` | Démarre le serveur de production |
| `npm run lint` | ESLint |
| `npm run db:seed` | Idempotent : catégories + formateur démo + 4 cours |
| `npm run assistant:seed` | Idempotent : synchronise la base documentaire Aiduca-IA depuis le site |
| `npx prisma generate` | Régénère le client Prisma |
| `npx prisma migrate dev` | Crée et applique une migration en dev |
| `npx prisma studio` | UI Prisma pour explorer la base |
| `stripe listen --forward-to http://localhost:3000/api/webhooks/stripe` | Webhook Stripe en local |

### Aiduca-IA

Après les migrations, configurez `ANTHROPIC_API_KEY`, puis ouvrez
`/admin/assistant/sources` et cliquez sur **Synchroniser le site**. La même
opération est disponible en local avec `npm run assistant:seed`. Elle met à
jour uniquement les documents générés dont le slug commence par `auto-` ; les
documents ajoutés manuellement dans l'administration sont conservés.

---

## Architecture

```
e-formationgn/
├── prisma/
│   ├── schema.prisma          # 28 modèles, 14 enums
│   └── seed.ts                # Données de démonstration
├── public/
│   ├── logo.svg / logo-white.svg / logo-mark.svg
├── src/
│   ├── app/                   # Routes App Router (52 pages/API)
│   │   ├── (auth)/            # Group route inscription/connexion/...
│   │   ├── admin/             # Espace administrateur
│   │   ├── apprentissage/     # Espace élève (lecteur, progression)
│   │   ├── api/               # Route handlers + webhooks
│   │   ├── commande/          # Confirmation d'achat
│   │   ├── cours/             # Catalogue + Q&A
│   │   ├── categories/        # Catégories
│   │   ├── certificat/        # Vérification publique
│   │   ├── formateur/         # Espace formateur
│   │   ├── ...                # CMS (cgv, mentions-legales, …)
│   │   ├── layout.tsx
│   │   ├── page.tsx           # Home
│   │   ├── sitemap.ts
│   │   └── robots.ts
│   ├── auth.ts / auth.config.ts / proxy.ts
│   ├── components/
│   │   ├── ui/                # Primitives
│   │   ├── layout/
│   │   ├── branding/
│   │   └── features/          # Composants par domaine métier
│   ├── lib/
│   │   ├── prisma.ts          # Singleton + adapter pg
│   │   ├── stripe.ts          # Client + webhook secret
│   │   ├── mux.ts             # Direct upload + asset/upload helpers
│   │   ├── pdf-certificate.ts # pdf-lib
│   │   ├── cms.ts             # Pages éditoriales avec fallback
│   │   ├── affiliate.ts       # Cookie de tracking
│   │   ├── currency.ts        # EUR/USD toggle
│   │   ├── commission.ts      # 15% / 30%
│   │   ├── money.ts           # Format prix
│   │   ├── format/            # Durations + labels FR
│   │   ├── auth/              # bcrypt + tokens
│   │   ├── email/             # Resend client + templates
│   │   ├── slug.ts
│   │   ├── env.ts             # Validation Zod
│   │   └── utils.ts           # cn()
│   ├── server/
│   │   ├── actions/           # Server Actions
│   │   └── queries/           # Lectures DB
│   ├── types/
│   └── generated/prisma/      # Client Prisma (gitignored)
├── BRAND.md
├── README.md
└── package.json
```

---

## Modèle économique (commissions)

À chaque vente, la commission de la plateforme est calculée selon la source :

- **15 %** si la vente est attribuée au formateur via son lien d'affiliation
  (`?ref=<affiliateCode>`).
- **30 %** sinon (vente issue de la plateforme : recherche, recommandations, marketing).

Les taux par défaut sont configurables via `/admin/commissions` (table
`CommissionRate`). Chaque `OrderItem` snapshote le taux appliqué pour rester
immuable même si l'admin change le taux ensuite.

**Pattern Stripe** : *separate charges and transfers*. La plateforme
encaisse via Stripe Checkout, puis pousse un `Transfer` par formateur sur
son compte Express. Idempotency-key par order × instructeur.

---

## Sécurité

- bcrypt cost 12 sur les mots de passe
- JWT signé via `NEXTAUTH_SECRET`
- Tokens cryptographiques (`crypto.randomBytes` 32 octets, base64url)
- Anti-énumération sur reset password (réponse identique pour email connu/inconnu)
- Webhook Stripe : signature obligatoire (`stripe-signature` + `STRIPE_WEBHOOK_SECRET`)
- Webhook Mux : signature obligatoire via `mux.webhooks.unwrap()`
- Toutes les Server Actions sensibles vérifient session + propriété de la ressource
- Commission calculée **uniquement côté serveur** (jamais lue depuis le client)
- AuditLog sur toute action admin (`category.update`, `commission.update`,
  `course.approve`, etc.)

---

## Conventions

- Interface utilisateur **100 % en français**.
- Identifiants (variables, fonctions, modèles, types) **en anglais**.
- TypeScript strict, **pas de `any`**.
- **Server Components par défaut** ; `"use client"` uniquement si nécessaire.
- **Server Actions** pour toutes les mutations (pas d'API Route inutile).
- **Validation Zod** systématique côté serveur.
- **Accessibilité** WCAG AA, **mobile-first**.

---

## Comptes de démonstration

Après `npm run db:seed` :

- **Formateur démo** : `formateur@e-formationgn.com` / `Demo1234!`
  Auteur des 4 cours seedés. Code d'affiliation : `awa-diallo`.

Pour créer un **administrateur**, faites une inscription standard, vérifiez
l'email (le lien s'affiche dans la console en dev), puis en SQL :

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'votre@email.com';
```

(Ou directement depuis Prisma Studio.) L'admin a accès à `/admin`.

---

## Déploiement Vercel

### 1) Préparer le projet

```bash
git init
git add .
git commit -m "feat: plateforme E-FormationGN v1"
git remote add origin git@github.com:votre-compte/e-formationgn.git
git push -u origin main
```

### 2) Importer dans Vercel

- https://vercel.com/new → Import votre repo GitHub
- Framework preset : Next.js (auto-détecté)
- Build Command : `next build` (par défaut)
- Output : `.next` (par défaut)

### 3) Variables d'environnement

Ajouter dans Vercel → Settings → Environment Variables :

- Toutes les variables de `.env.example` ci-dessus, avec les **clés de prod**
  (Stripe live, Mux production, Supabase prod).
- `NEXTAUTH_URL` = `https://e-formationgn.com`
- `NEXT_PUBLIC_APP_URL` = `https://e-formationgn.com`

### 4) Configuration des webhooks en prod

- **Stripe** : Dashboard → Developers → Webhooks → Add endpoint
  `https://e-formationgn.com/api/webhooks/stripe`. Cocher au minimum :
  `checkout.session.completed`, `payment_intent.payment_failed`,
  `charge.refunded`. Copier le `Signing secret` dans `STRIPE_WEBHOOK_SECRET`.
- **Mux** : Dashboard → Settings → Webhooks → New webhook
  `https://e-formationgn.com/api/webhooks/mux`. Cocher :
  `video.upload.asset_created`, `video.asset.ready`, `video.asset.errored`.
  Copier le secret dans `MUX_WEBHOOK_SECRET`.

### 5) Domaine

- Vercel → Domains → Add → `e-formationgn.com`
- Suivre les instructions DNS (A/CNAME) chez votre registrar (Cloudflare
  Registrar recommandé pour la simplicité).

### 6) Migrations en prod

Le repo contient une **baseline `prisma/migrations/0_init`** + une migration
`1_course_search` (full-text Postgres). À chaque déploiement :

```bash
DATABASE_URL="<URL prod>" npx prisma migrate deploy
```

À configurer comme **Build Command** Vercel pour l'automatiser :

```
prisma migrate deploy && next build
```

> **Première fois sur une base existante (déjà synchronisée via `db push`)** :
> avant `migrate deploy`, marquer les migrations comme déjà appliquées :
> ```bash
> npx prisma migrate resolve --applied 0_init
> npx prisma migrate resolve --applied 1_course_search
> ```

Healthcheck pour les sondes UptimeRobot/BetterStack/Vercel :
`GET /api/health` → `200` si la base répond, `503` sinon.

### 7) Configurer Stripe Connect

- Dashboard → Settings → Connect → Get started → choisir **Express**
- Définir le branding (logo, couleurs, URL retour)
- Récupérer `STRIPE_CONNECT_CLIENT_ID` (ca_…)

### 8) Configurer Resend

- Resend → Domains → Add → `e-formationgn.com`
- Ajouter les enregistrements DKIM/SPF/DMARC chez votre registrar
- Une fois le domaine vérifié, mettre à jour `RESEND_FROM_EMAIL` :
  `E-FormationGN <noreply@e-formationgn.com>`

---

## Roadmap (post-v1)

- Intégration vraie d'images : presigned upload R2 ou Supabase Storage
- Drag-and-drop pour réordonner sections/leçons (`@dnd-kit`)
- Éditeur rich-text (Tiptap) pour la description et les leçons textuelles
- Recherche Algolia / Postgres FTS pour les gros catalogues
- Notifications temps réel (Supabase Realtime)
- App mobile (React Native + Expo)
- Multilangue (FR + EN + autres)
- Analytics formateur poussées (revenu mensuel, cohortes, churn)

---

## Licence

© 2026 E-FormationGN. Tous droits réservés.
