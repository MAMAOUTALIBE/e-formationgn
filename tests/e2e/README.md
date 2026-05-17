# Tests E2E (Playwright)

Tests d'intégration HTTP qui frappent un serveur **dev local** déjà lancé
(`npm run dev`). On ne démarre pas Next.js depuis Playwright pour ne pas
bloquer si un serveur tourne déjà — cf. [playwright.config.ts](../../playwright.config.ts).

## Lancer

```bash
# 1. Dans un terminal : dev server + DB Postgres
npm run dev

# 2. Dans un autre terminal : tous les tests E2E
npm run test:e2e

# Un seul fichier
npx playwright test tests/e2e/seo.spec.ts

# Filtrer par titre
npx playwright test -g "pagination"
```

Première exécution : `npm run test:e2e:install` télécharge le binaire Chromium.

## Fichiers

| Fichier | Couverture |
|---|---|
| `routes.spec.ts` | Couverture HTTP de toutes les routes (publique / protégée / API / webhooks). Ajoutez une ligne dans les listes en haut quand une route apparaît. |
| `smoke.spec.ts` | Pages publiques rendent un h1 + un header (vérif visuelle minimale). |
| `seo.spec.ts` | JSON-LD `Course` + `BreadcrumbList`, hreflang multi-pays, OG image dynamique. |
| `catalog.spec.ts` | Recherche full-text, filtres, tris, pagination stable (régression Sprint 4). |
| `security.spec.ts` | Rate-limit, open-redirect, webhooks signature, headers HTTP, RBAC anonyme. |

## Pré-requis seed

Plusieurs tests assument les **4 cours seedés** :
- `nextjs-fondamentaux-2026` (cours pivot pour SEO)
- `anglais-professionnel-b2`
- `design-ui-debutant`
- `marketing-digital-essentiel`

Et les **8 catégories**, dont `developpement`, `marketing`, etc.

Si manquant : `npm run db:seed` (idempotent).

## Quand ajouter un test ?

- **Nouvelle route publique** → ligne dans `routes.spec.ts:PUBLIC_PAGES`.
- **Nouveau gate auth** → ligne dans `routes.spec.ts:PROTECTED_PAGES`.
- **Nouveau webhook** → ligne dans `routes.spec.ts:WEBHOOKS_GET` + cas
  dédié dans `security.spec.ts` pour la signature.
- **Nouvelle metadata SEO** (JSON-LD, OG, hreflang) → cas dans `seo.spec.ts`.
- **Bug fixé** dans recherche / cache / pagination → cas de régression dans
  `catalog.spec.ts` avec commentaire « régression Sprint N ».
