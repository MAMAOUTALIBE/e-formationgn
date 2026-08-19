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
    register: string;
    logout: string;
    search: string;
    catalog: string;
    categories: string;
    becomeInstructor: string;
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
    register: "S'inscrire",
    logout: "Déconnexion",
    search: "Rechercher une formation…",
    catalog: "Catalogue",
    categories: "Catégories",
    becomeInstructor: "Devenir formateur",
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
    badge: "Plateforme N°1 de formation en Guinée",
    headline1: "Développez des compétences",
    headline2: "recherchées",
    description:
      "Accédez à des centaines de formations dispensées par des formateurs francophones confirmés. Apprenez à votre rythme et obtenez votre certification.",
    ctaPrimary: "Commencer maintenant",
    ctaSecondary: "Devenir formateur",
    activeStudents: "élèves actifs",
  },
  footer: {
    tagline: "La marketplace francophone de formation en ligne.",
    platform: "Plateforme",
    about: "À propos",
    legal: "Légal",
    contact: "Contact",
    blog: "Blog",
    rights: "Tous droits réservés.",
    rgpd: "Conformité RGPD · Données hébergées dans l'Union européenne",
  },
  language: {
    label: "Langue",
  },
};

const en: Dictionary = {
  common: {
    login: "Sign in",
    register: "Sign up",
    logout: "Sign out",
    search: "Search a training course…",
    catalog: "Catalog",
    categories: "Categories",
    becomeInstructor: "Become an instructor",
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
    badge: "#1 training platform in Guinea",
    headline1: "Build the skills",
    headline2: "employers want",
    description:
      "Access hundreds of training courses taught by experienced French-speaking instructors. Learn at your own pace and earn your certification.",
    ctaPrimary: "Start now",
    ctaSecondary: "Become an instructor",
    activeStudents: "active students",
  },
  footer: {
    tagline: "The francophone marketplace for online learning.",
    platform: "Platform",
    about: "About",
    legal: "Legal",
    contact: "Contact",
    blog: "Blog",
    rights: "All rights reserved.",
    rgpd: "GDPR compliant · Data hosted in the European Union",
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
