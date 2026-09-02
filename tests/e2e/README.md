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
| `rbac-roles.spec.ts` | Cloisonnement élève / formateur / administration, écrans **et** API. Vérifie aussi que le volet financier retiré (`REMOVED_PAGES` de `src/proxy.ts`) répond bien 404/410, et qu'aucun lien du menu admin n'y mène. |
| `idor-ownership.spec.ts` | Cloisonnement horizontal : un formateur n'atteint pas les formations d'un autre, un élève n'atteint pas le contenu d'une formation qu'il ne suit pas. |
| `journeys.spec.ts` | Parcours réels avec écritures : création de formation, écrans d'administration, espace élève, pages d'erreur. |
| `security-probes.spec.ts` | Injection SQL, fuite de secrets, cookies de session, types de fichiers téléversés, traversée de chemin. |
| `a11y-responsive.spec.ts` | Structure accessible (lang, h1 unique, alt, étiquettes, clavier), absence de débordement en mobile / tablette / ordinateur, console sans erreur. |

## Comptes de recette

Les suites par rôle (`rbac-roles`, `idor-ownership`, `journeys`,
`security-probes`, en partie) exigent les comptes de démonstration :

```bash
npx tsx scripts/seed-qa-accounts.ts
```

Le script refuse de s'exécuter ailleurs qu'en local — ces comptes ont un mot de
passe publié dans le dépôt. Il pose trois rôles (`qa.eleve@`, `qa.formateur@`,
`qa.admin@`, tous en `@audit.local`), un second formateur pour les contrôles de
cloisonnement, et une formation par formateur.

`admin-smoke.spec.ts` se saute tant que `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`
ne sont pas posées — or c'est la seule suite qui ouvre chaque écran du CRM avec
une session et échoue sur une frontière d'erreur. Le compte de recette convient :

```bash
E2E_ADMIN_EMAIL=qa.admin@audit.local E2E_ADMIN_PASSWORD='AuditQA2026!' \
  npx playwright test tests/e2e/admin-smoke.spec.ts
```

**La connexion est plafonnée à 10 essais par quart d'heure et par couple
(IP, compte).** C'est pourquoi ces suites tournent en `describe.serial` sur une
page partagée : une reconnexion par cas de test épuiserait ce budget et
produirait des échecs qui ne diraient rien du code. Si des tests de rôle
échouent tous à la connexion, c'est ce compteur — il se vide en redémarrant le
serveur (le limiteur est en mémoire) ou en attendant.

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
- **Nouvel écran réservé à un rôle** → ligne dans `rbac-roles.spec.ts`
  (`INSTRUCTOR_PAGES` ou `ADMIN_PAGES`) : le test vérifie à la fois que le rôle
  concerné y entre et que les autres n'y entrent pas.
- **Écran retiré au niveau du proxy** → ligne dans `REMOVED_PAGES` de
  `src/proxy.ts` ; `rbac-roles.spec.ts` et `tests/unit/removed-pages-links.test.ts`
  s'y adossent et signaleront tout lien de l'interface qui y mènerait encore.
