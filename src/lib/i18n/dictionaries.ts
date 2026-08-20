// Dictionnaires de traduction — pure data, importable côté client et serveur.
// On garde un seul fichier TS plutôt que des JSON pour la complétion auto et
// la détection des clés manquantes au build.

export type Locale = "fr" | "en";

export const SUPPORTED_LOCALES: Locale[] = ["fr", "en"];
export const DEFAULT_LOCALE: Locale = "fr";

export const LOCALE_LABELS: Record<Locale, string> = {
  fr: "Français",
  en: "English",
};

export const LOCALE_SHORT: Record<Locale, string> = {
  fr: "FR",
  en: "EN",
};

interface Dictionary {
  common: {
    login: string;
    logout: string;
    search: string;
    catalog: string;
    categories: string;
    myLearning: string;
    cart: string;
    profile: string;
    administration: string;
    instructorSpace: string;
    save: string;
    cancel: string;
    delete: string;
    confirm: string;
    loading: string;
  };
  hero: {
    badge: string;
    headline1: string;
    headline2: string;
    description: string;
    ctaPrimary: string;
    ctaSecondary: string;
    activeStudents: string;
  };
  footer: {
    tagline: string;
    platform: string;
    about: string;
    legal: string;
    contact: string;
    blog: string;
    rights: string;
    rgpd: string;
  };
  language: {
    label: string;
  };
}

const fr: Dictionary = {
  common: {
    login: "Connexion",
    logout: "Déconnexion",
    search: "Rechercher une formation…",
    catalog: "Catalogue",
    categories: "Catégories",
    myLearning: "Mon apprentissage",
    cart: "Panier",
    profile: "Profil",
    administration: "Administration",
    instructorSpace: "Espace formateur",
    save: "Enregistrer",
    cancel: "Annuler",
    delete: "Supprimer",
    confirm: "Confirmer",
    loading: "Chargement…",
  },
  hero: {
    badge: "Organisme de formation certifié Qualiopi",
    headline1: "Développez des compétences",
    headline2: "recherchées",
    description:
      "Développez vos compétences avec les formations professionnelles d’Aiduca, conçues pour accompagner votre progression.",
    ctaPrimary: "Commencer maintenant",
    ctaSecondary: "Découvrir Aiduca",
    activeStudents: "élèves actifs",
  },
  footer: {
    tagline: "Des formations professionnelles pour développer vos compétences.",
    platform: "Plateforme",
    about: "À propos",
    legal: "Légal",
    contact: "Contact",
    blog: "Blog",
    rights: "Tous droits réservés.",
    rgpd: "Protection des données · Consultez notre politique de confidentialité",
  },
  language: {
    label: "Langue",
  },
};

const en: Dictionary = {
  common: {
    login: "Sign in",
    logout: "Sign out",
    search: "Search a training course…",
    catalog: "Catalog",
    categories: "Categories",
    myLearning: "My learning",
    cart: "Cart",
    profile: "Profile",
    administration: "Administration",
    instructorSpace: "Instructor space",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    confirm: "Confirm",
    loading: "Loading…",
  },
  hero: {
    badge: "Qualiopi-certified training provider",
    headline1: "Build the skills",
    headline2: "employers want",
    description:
      "Develop your skills with Aiduca’s professional training courses, designed to support your progress.",
    ctaPrimary: "Start now",
    ctaSecondary: "Discover Aiduca",
    activeStudents: "active students",
  },
  footer: {
    tagline: "Professional training courses to build your skills.",
    platform: "Platform",
    about: "About",
    legal: "Legal",
    contact: "Contact",
    blog: "Blog",
    rights: "All rights reserved.",
    rgpd: "Data protection · Read our privacy policy",
  },
  language: {
    label: "Language",
  },
};

const DICTIONARIES: Record<Locale, Dictionary> = { fr, en };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && SUPPORTED_LOCALES.includes(value as Locale);
}
