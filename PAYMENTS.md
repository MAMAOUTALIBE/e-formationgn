# Paiements — E-FormationGN

Ce document décrit la stratégie de paiement (PSP, devises, payouts) et les
flux côté code. Ressource opérationnelle pour les nouveaux contributeurs et
pour la mise en prod.

## Vue d'ensemble

| Cible | PSP | Devises | Modes |
|---|---|---|---|
| **Diaspora / international** | Stripe Checkout | EUR, USD | Carte Visa / Mastercard / Amex, Apple Pay, Google Pay |
| **Guinée locale** | CinetPay | GNF, EUR, USD | **Mobile Money** (Orange Money GN, MTN MoMo), carte locale |
| **Afrique de l'Ouest francophone** | CinetPay | XOF, EUR, USD | Mobile Money (Orange/MTN/Moov CI/SN/ML), carte |

Le choix du PSP au moment du paiement se fait en fonction de :
1. La devise sélectionnée dans le panier (cf. `setCurrency` action)
2. Le mode de paiement souhaité (UI checkout — implémenté en session 2)

| Devise → | EUR / USD | GNF / XOF |
|---|---|---|
| **Carte internationale** | Stripe ✅ | — |
| **Mobile Money / carte locale** | CinetPay ✅ | CinetPay ✅ |

## Devises côté DB

`Currency` enum Prisma : `EUR`, `USD`, `GNF`, `XOF` (cf. `prisma/schema.prisma`).

`Course` a 4 paires de prix :
- `priceEUR` / `discountPriceEUR` — Decimal(10, 2)
- `priceUSD` / `discountPriceUSD` — Decimal(10, 2)
- `priceGNF` / `discountPriceGNF` — Decimal(12, 0) (pas de subdivision)
- `priceXOF` / `discountPriceXOF` — Decimal(12, 0)

Le formateur fixe ses prix en remplissant les 4 champs (UI tarification —
session 2).

## Order.totalCents — minor units

`Order.totalCents` stocke la valeur en « minor units » :

| Devise | Minor units | Exemple |
|---|---|---|
| EUR | centimes | 49.90 € → `4990` |
| USD | cents | 54.90 $ → `5490` |
| GNF | unités | 25 000 GNF → `25000` |
| XOF | unités | 15 000 XOF → `15000` |

Helpers : `lib/payments/currency.ts` (`amountToMinor`, `minorToAmount`,
`formatMinor`, `currencyMinorMultiplier`).

## Stripe — flux carte internationale (EUR/USD)

Webhooks signés via `STRIPE_WEBHOOK_SECRET` — cf. `api/webhooks/stripe/route.ts`.

Events traités :
- `checkout.session.completed` → marque Order PAID, crée Enrollments
- `payment_intent.payment_failed` / `canceled` → Order FAILED / CANCELLED
- `charge.refunded` → REFUNDED ou PARTIALLY_REFUNDED (lecture
  `amount_refunded` direct ou via `refunds.list` en fallback)
- `charge.dispute.*` → table `Dispute` mise à jour + AuditLog
- `account.updated` → MAJ statut Stripe Connect formateur
- `payout.paid` / `payout.failed` → table `Payout`

Stripe Connect : code en place pour transfers automatiques vers les comptes
formateurs internationaux. **Désactivable** si on choisit payouts manuels
(notre choix actuel) — il suffit de ne pas configurer `STRIPE_CONNECT_CLIENT_ID`.

## CinetPay — flux Mobile Money / local

Webhook signé via `x-token` (HMAC-SHA256 du body avec `CINETPAY_SECRET_KEY`)
— cf. `api/webhooks/cinetpay/route.ts`.

Flux côté checkout (à câbler en session 2) :
1. Server Action initie l'Order (status PENDING) avec devise GNF/XOF
2. Appel `initTransaction()` → reçoit `payment_url`
3. Redirection utilisateur vers `payment_url`
4. Utilisateur paie via Mobile Money (Orange Money, MTN MoMo) ou carte locale
5. CinetPay POST notre IPN `/api/webhooks/cinetpay`
6. On vérifie la signature + on RE-VÉRIFIE via `checkTransaction()` (jamais
   se fier au seul payload IPN — cf. recommandation CinetPay)
7. Si `ACCEPTED` → marque Order PAID, crée Enrollments (idempotent)

Lib : `src/lib/payments/cinetpay.ts`.

## Payouts formateurs — manuel

Choix actuel : **payouts mensuels manuels en Mobile Money / virement local**.

- Stripe Connect : non utilisé pour la Guinée (pas supporté côté Stripe)
- CinetPay Transfert API : disponible mais nécessite KYC/AML supplémentaire
- Process actuel : équipe finance exporte mensuellement les gains
  via `/admin/finances/payouts`, paie les formateurs en MoMo / virement,
  marque les payouts comme PAID

Avantages :
- Simple à mettre en place dès le départ
- Conformité KYC du formateur traitée hors-plateforme
- Compatible avec tous les moyens de paiement Guinée

Inconvénients :
- Charge opérationnelle mensuelle (compter ~1h/100 formateurs)
- Risque d'erreur humaine (matching Order → formateur)
- Pas de traçabilité native dans Stripe / CinetPay

À automatiser plus tard (ex: V2 avec CinetPay Transfert).

## Variables d'environnement

```
# Stripe
STRIPE_SECRET_KEY=sk_live_…
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_…
STRIPE_WEBHOOK_SECRET=whsec_…
STRIPE_CONNECT_CLIENT_ID=ca_…   # optionnel

# CinetPay
CINETPAY_API_KEY=…
CINETPAY_SITE_ID=…
CINETPAY_SECRET_KEY=…

# Plateforme
PLATFORM_DEFAULT_CURRENCY=EUR   # ou GNF si on veut prioriser local
PLATFORM_COMMISSION_INSTRUCTOR_BPS=1500   # 15 %
PLATFORM_COMMISSION_PLATFORM_BPS=3000     # 30 %
```

## Activation prod (checklist)

### Stripe
- [ ] Créer compte Stripe (mode test puis live)
- [ ] Onboarding entreprise (KYB)
- [ ] Récupérer `sk_live_…` + `pk_live_…`
- [ ] Configurer le webhook : `https://${DOMAIN}/api/webhooks/stripe`
  - Events : checkout.session.completed, payment_intent.*, charge.refunded,
    charge.dispute.*, account.updated, payout.paid, payout.failed
  - Récupérer le signing secret `whsec_…` → `STRIPE_WEBHOOK_SECRET`
- [ ] Tester avec une carte de test (4242 4242 4242 4242)

### CinetPay
- [ ] Créer compte sur https://www.cinetpay.com
- [ ] Vérifier l'éligibilité (Guinée supportée pour MoMo)
- [ ] Onboarding KYB (CNI gérant, registre commerce, RIB)
- [ ] Récupérer API Key, Site ID, Secret Key
- [ ] Configurer URL IPN : `https://${DOMAIN}/api/webhooks/cinetpay`
- [ ] Activer les modes : Mobile Money + Carte
- [ ] Tester avec un compte test CinetPay

### Devises affichées
- [ ] Décider la devise par défaut (recommandé : GNF si majorité d'élèves
  guinéens, sinon EUR)
- [ ] Activer le toggle multi-devises (UI cart) : à faire en session 2

## Tests E2E paiement (à faire)

Fichier : `tests/e2e/checkout.spec.ts` (à créer en session 2).

Scénarios :
- Ajout cours au panier → checkout EUR via Stripe (mode test)
- Ajout cours au panier → checkout GNF via CinetPay (mode test)
- Webhook Stripe avec body invalide → 400
- Webhook CinetPay avec x-token invalide → 400
- Order créé, jamais payé → expiration / cleanup cron

## Reporting financier

Page `/admin/finances` (existant) :
- Vue par devise
- Conversion croisée optionnelle (vers EUR canonique pour reporting global)
- Filtrer par PSP (Stripe vs CinetPay) — à ajouter en session 2
