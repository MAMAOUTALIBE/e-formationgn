# Paiements en mode TEST — Gandal

Guide pas-à-pas pour tester les flux Stripe + CinetPay en local **sans
aucune transaction réelle**.

## ✅ Vue d'ensemble

| PSP | Mode test | Cartes / numéros de test |
|---|---|---|
| Stripe | `sk_test_…` / `pk_test_…` | `4242 4242 4242 4242` (réussite) |
| CinetPay | `CINETPAY_MODE=test` + clés sandbox | numéros Mobile Money fictifs (dashboard) |

Le banner orange « Mode test actif » s'affiche automatiquement en haut du
site dès qu'un PSP est en test (cf. `lib/payments/payment-mode.ts`).

## 1. Stripe TEST en local

### 1.1 Créer le compte (5 min)

1. https://dashboard.stripe.com/register — compte gratuit
2. En haut à droite du dashboard, basculer en **mode Test** (toggle)
3. Aller dans **Developers → API keys**
4. Copier :
   - **Secret key** : `sk_test_…` → `STRIPE_SECRET_KEY`
   - **Publishable key** : `pk_test_…` → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

### 1.2 Webhook local avec Stripe CLI

```bash
# Installation Stripe CLI (Mac)
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward des webhooks vers le dev server local
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Le terminal affiche : `Ready! Your webhook signing secret is whsec_…`

→ Copier ce secret dans `.env` : `STRIPE_WEBHOOK_SECRET=whsec_…`

**Garde le terminal ouvert** pendant tes tests — il forwarde chaque
webhook reçu par Stripe vers ton localhost.

### 1.3 Tester le flow complet

1. Sur Gandal, ajoute un cours payant au panier (devise EUR ou USD)
2. Va sur `/panier`, choisis **Carte internationale (Stripe)**
3. Clique « Payer par carte »
4. Sur la page Stripe Checkout :
   - Email : n'importe lequel
   - Carte : `4242 4242 4242 4242`
   - Date : `12 / 30`, CVC : `123`
   - Nom + adresse : libres
5. Valider → retour sur `/commande/<id>/confirmation`
6. Vérifier dans le terminal Stripe CLI que `checkout.session.completed`
   a bien été reçu et que notre webhook a renvoyé 200
7. Vérifier en base : `Order.status = PAID`, `Enrollment` créé pour
   chaque ligne, `CartItem` vide

### 1.4 Cartes de test Stripe utiles

| Numéro | Comportement |
|---|---|
| `4242 4242 4242 4242` | ✅ Succès (sans 3DS) |
| `4000 0025 0000 3155` | ✅ Succès avec authentification 3DS |
| `4000 0000 0000 9995` | ❌ Refusée (insufficient_funds) |
| `4000 0000 0000 0341` | ❌ Charge réussie mais dispute (chargeback) |

Documentation complète : https://stripe.com/docs/testing

## 2. CinetPay TEST (sandbox)

### 2.1 Créer le compte

1. https://www.cinetpay.com → « Créer un compte »
2. Onboarding KYB léger pour le mode test (juste email + mot de passe)
3. Dans le dashboard → **Paramètres → Intégration** → récupérer :
   - API Key
   - Site ID
   - Secret Key

### 2.2 Webhook IPN local avec ngrok

CinetPay POST l'IPN sur une URL publique. Pour tester en local on expose
le port 3000 via ngrok ou cloudflared :

```bash
# Installation ngrok (Mac)
brew install ngrok

# Login (compte gratuit sur ngrok.com)
ngrok config add-authtoken <votre_token>

# Tunnel HTTP vers localhost:3000
ngrok http 3000
```

Le terminal affiche : `Forwarding https://abc123.ngrok-free.app -> http://localhost:3000`

→ Dans le dashboard CinetPay, configurer **URL IPN** :
```
https://abc123.ngrok-free.app/api/webhooks/cinetpay
```

Variables `.env` :
```
CINETPAY_API_KEY=…
CINETPAY_SITE_ID=…
CINETPAY_SECRET_KEY=…
CINETPAY_MODE=test
```

### 2.3 Tester le flow Mobile Money

1. Ajoute un cours payant au panier (devise GNF ou XOF — l'option Stripe
   sera désactivée, seule CinetPay reste cliquable)
2. Va sur `/panier`, le radio CinetPay est sélectionné par défaut
3. Clique « Payer avec Mobile Money »
4. Sur la page CinetPay :
   - Choisir **Orange Money** ou **MTN Mobile Money**
   - Numéro de test : voir le dashboard CinetPay dans la section sandbox
5. Valider → CinetPay renvoie sur `/commande/<id>/confirmation`
6. Le `ConfirmationPoll` rafraîchit toutes les 5 s en attendant que
   l'IPN arrive (max 1 min). L'Order doit passer PENDING → PAID.

## 3. Vérifier la config

```bash
npm run check:payments
```

Sort un rapport :
```
── Stripe ──
✓ STRIPE_SECRET_KEY TEST (sk_test_…)
✓ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY présent.
✓ STRIPE_WEBHOOK_SECRET présent.
✓ Stripe API joignable — compte acct_… (FR).

── CinetPay ──
✓ Configuration trouvée — mode TEST.
✓ CinetPay API joignable — auth acceptée (réponse : MISSING_TRANSACTION).

✓ Configuration OK.
```

## 4. Page admin pour visualiser

`/admin/parametres/paiements` — affiche le statut des deux PSP, les URL
de webhook à configurer, et les cartes de test.

## 5. Passer en production (plus tard)

Quand vous serez prêt à encaisser de vraies transactions :

1. Stripe → Activer le compte (KYB complet : business, RIB, dirigeant)
2. Récupérer les clés `sk_live_…` / `pk_live_…`
3. Créer un webhook prod sur `https://gandal.gn/api/webhooks/stripe`
4. Idem CinetPay : passer en mode live, configurer l'IPN prod
5. Sur le VPS Hostinger, mettre à jour `.env` avec les clés live
6. `CINETPAY_MODE=live` (ou retirer la variable — défaut live)
7. Redéployer

Le banner « Mode test » disparaît automatiquement.

## 6. Dépannage

| Symptôme | Cause | Fix |
|---|---|---|
| Banner ne s'affiche pas | Aucune clé test détectée | Vérifier `.env` rechargé (`npm run dev`) |
| Webhook Stripe → 400 | `STRIPE_WEBHOOK_SECRET` manquant ou stale | Récupérer le whsec_ frais via `stripe listen` |
| Webhook CinetPay → 400 | `x-token` invalide | Vérifier `CINETPAY_SECRET_KEY` |
| Order reste PENDING | IPN jamais reçu | Vérifier ngrok actif + URL IPN dans dashboard CinetPay |
| Bouton « Payer » désactivé | PSP non détecté | `npm run check:payments` |
| `4242` refusée | Mode live actif | Vérifier que la clé commence par `sk_test_` |
