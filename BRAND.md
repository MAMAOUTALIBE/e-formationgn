# BRAND.md — Identité visuelle E-FormationGN

Ce document décrit la charte graphique et le ton de communication. Il fait
foi pour toute décision visuelle sur la plateforme. Toute évolution doit y
être consignée.

---

## 1. Identité

| Champ                 | Valeur                                    |
| --------------------- | ----------------------------------------- |
| Nom                   | E-FormationGN                             |
| Domaine               | e-formationgn.com                         |
| Langue de l'interface | Français (FR-fr)                          |
| Devises               | EUR (par défaut), USD                     |
| Style                 | Sobre, professionnel, corporate           |
| Inspiration           | LinkedIn Learning, Pluralsight, Coursera  |
| Baseline              | « Apprendre. Enseigner. Progresser. »     |

---

## 2. Palette de couleurs

### Couleurs de marque

| Token              | HEX       | Usage                                       |
| ------------------ | --------- | ------------------------------------------- |
| `--brand-primary`  | `#1E3A8A` | Bleu marine corporate — titres, header      |
| `--brand-secondary`| `#2563EB` | Bleu vif — boutons d'action (CTA), liens    |
| `--brand-accent`   | `#0EA5E9` | Bleu ciel — highlights, badges, focus       |
| `--brand-violet`   | `#7C3AED` | Violet — accents marketing landing publique |
| `--brand-violet-deep` | `#5B21B6` | Violet sombre — gradients, dark blocks   |
| `--brand-mint`     | `#92F6A1` | Vert menthe — accent CTA conversion         |
| `--brand-mint-deep`| `#6CE382` | Vert menthe foncé — hover                   |
| `--brand-success`  | `#059669` | Vert sobre — confirmations, succès          |
| `--brand-danger`   | `#DC2626` | Rouge sobre — erreurs, suppression          |
| `--brand-warning`  | `#D97706` | Orange sobre — avertissements               |

> Le violet est **réservé** à la landing publique (home, pages marketing) :
> hero gradient, dark block "Réinventez votre carrière", badges promo. Ne
> pas l'utiliser dans les écrans authentifiés (admin, formateur, espace
> apprenant) qui restent sur la palette bleue corporate.

### Neutres

| Token         | HEX       | Usage                                  |
| ------------- | --------- | -------------------------------------- |
| `--neutral-900` | `#0F172A` | Texte principal                        |
| `--neutral-600` | `#475569` | Texte secondaire                       |
| `--neutral-300` | `#CBD5E1` | Bordures, séparateurs                  |
| `--neutral-100` | `#F1F5F9` | Fonds discrets (cards en variation)    |
| `--neutral-50`  | `#F8FAFC` | Fond clair principal                   |

### Mode sombre

Toggle utilisateur (classe `.dark` posée sur `<html>`). Les tokens
`--background`, `--foreground`, `--card`, `--border` sont surchargés dans
`globals.css`. Conserver les couleurs de marque (primary/accent) en
contraste suffisant (WCAG AA minimum sur tout texte).

---

## 3. Typographie

- **Famille** : `Inter` (chargée via `next/font/google`).
- **Variable CSS** : `--font-inter` (exposée en `font-sans` dans Tailwind).
- **Titres** : `font-semibold` à `font-bold`, `tracking-tight`.
- **Corps** : `font-normal`, `leading-7`.
- **Hiérarchie** :
  - h1 : `text-4xl` à `text-6xl` selon le contexte.
  - h2 : `text-2xl` à `text-3xl`.
  - h3 : `text-xl`.
  - body : `text-base` (16 px), `text-sm` pour les annotations.

---

## 4. Logo

Trois variantes disponibles dans `/public/` :

| Fichier              | Usage                                                |
| -------------------- | ---------------------------------------------------- |
| `logo.svg`           | Logo couleur sur fond clair (par défaut)             |
| `logo-white.svg`     | Logo blanc/contrasté pour fond foncé                 |
| `logo-mark.svg`      | Pictogramme seul (favicon, avatar, OG image carré)   |

Le pictogramme représente un livre ouvert + bouton « play » stylisé,
symbolisant l'apprentissage et la vidéo. Le wordmark utilise « E-Formation »
en bleu marine et « GN » en bleu vif (rappel du dégradé de marque).

**Espace de protection** : minimum la hauteur du « E » majuscule autour du
logo. Ne jamais :
- modifier les couleurs hors palette
- déformer les proportions
- ajouter d'effet (ombre, contour, gradient externe)

---

## 5. Composants UI

Construit sur shadcn/ui-style (composants headless basés sur Radix UI),
adapté à Tailwind v4 avec la palette ci-dessus. Tous les composants
primitifs vivent dans `src/components/ui/`.

- **Boutons** : variants `default` (primary), `secondary`, `outline`,
  `ghost`, `link`, `destructive`.
- **Inputs** : `h-10`, `rounded-md`, ring de focus `--brand-secondary`.
- **Cards** : `rounded-lg`, bordure `--border`, ombre légère.
- **Radius** : `--radius` = `0.5rem` (cohérent partout).

---

## 6. Iconographie

- Bibliothèque : [`lucide-react`](https://lucide.dev/).
- Tailles : 16, 20, 24 px selon le contexte.
- Couleur : héritée du texte (`currentColor`), jamais en couleur de marque
  brute (sauf cas particuliers : badges, alertes).

---

## 7. Tonalité et ton de communication

- **Vouvoiement** systématique vers l'utilisateur final.
- **Phrases courtes**, pédagogiques, sans jargon.
- **Verbes d'action** dans les CTA : « Explorer le catalogue »,
  « Devenir formateur », « Acheter maintenant ».
- **Pas de superlatifs marketing creux** (« incroyable », « génial »…).
- **Focus bénéfice utilisateur** : ce que l'élève / le formateur gagne.

### Vocabulaire à privilégier

| Préférer            | Éviter                |
| ------------------- | --------------------- |
| Cours, formation    | « Programme »         |
| Élève, apprenant    | « Utilisateur »       |
| Formateur, expert   | « Vendeur »           |
| Catalogue           | « Marketplace »       |
| Inscription gratuite | « Sign up »          |

---

## 8. Conformité et accessibilité

- **WCAG AA** minimum sur tous les textes (contraste 4.5:1).
- **Focus visible** systématique (`:focus-visible` configuré dans
  `globals.css`).
- **Navigation clavier** complète, `aria-label` sur tous les contrôles
  non textuels.
- **RGPD** : bandeau cookies à la première visite, page Confidentialité,
  droit d'accès / suppression accessibles depuis le profil utilisateur.

---

## 9. SEO & métadonnées sociales

- `metadataBase` : `https://e-formationgn.com`
- Open Graph : image `logo-mark.svg` (512×512) — à remplacer par une OG
  Image dynamique en Phase 8.
- Locale : `fr_FR`.
- `theme-color` : `#FFFFFF` (light) / `#0B1220` (dark).

---

## 10. Évolution

Toute modification de la charte doit être reflétée dans :
1. Ce fichier (BRAND.md).
2. `src/app/globals.css` (tokens CSS).
3. Les composants concernés.
4. Les emails transactionnels (`src/emails/`).
