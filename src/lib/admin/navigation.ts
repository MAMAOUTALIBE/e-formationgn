// Registre unique des pages du CRM admin.
//
// Pourquoi ce fichier : l'admin compte 44 pages statiques, dont 11 seulement
// figuraient dans la sidebar. Les 33 autres n'étaient atteignables que depuis
// la page d'index de leur section — et `parametres/paiements` n'était liée
// nulle part, donc accessible uniquement en tapant son URL.
//
// Ce registre est la source de vérité unique consommée par :
//   - <AdminSectionNav> : la barre de sous-navigation du layout admin ;
//   - <AdminCommandMenu> : les raccourcis du ⌘K.
// Ajouter une page ici la rend simultanément navigable et recherchable.

export interface AdminNavItem {
  href: string;
  label: string;
}

export interface AdminSection extends AdminNavItem {
  /** Sous-pages, toutes préfixées par `href` (la résolution est par préfixe). */
  children: AdminNavItem[];
}

export const ADMIN_SECTIONS: AdminSection[] = [
  { href: "/admin", label: "Vue d'ensemble", children: [] },
  {
    href: "/admin/analytics",
    label: "Analytics",
    children: [
      { href: "/admin/analytics/revenus", label: "Revenus" },
      { href: "/admin/analytics/funnel", label: "Tunnel de conversion" },
      { href: "/admin/analytics/cohortes", label: "Cohortes" },
      { href: "/admin/analytics/clients", label: "Clients" },
      { href: "/admin/analytics/apprentissage", label: "Apprentissage" },
    ],
  },
  {
    href: "/admin/finances",
    label: "Finances",
    children: [
      { href: "/admin/finances/transactions", label: "Transactions" },
      { href: "/admin/finances/remboursements", label: "Remboursements" },
      { href: "/admin/finances/payouts", label: "Versements formateurs" },
      { href: "/admin/finances/rapports", label: "Rapports comptables" },
    ],
  },
  {
    href: "/admin/marketing",
    label: "Marketing",
    children: [
      { href: "/admin/marketing/promotions", label: "Promotions" },
      { href: "/admin/marketing/codes-promo", label: "Codes promo" },
      { href: "/admin/marketing/campagnes-email", label: "Campagnes email" },
      { href: "/admin/marketing/affiliation", label: "Affiliation" },
      { href: "/admin/marketing/seo", label: "SEO" },
    ],
  },
  { href: "/admin/utilisateurs", label: "Utilisateurs", children: [] },
  { href: "/admin/formateurs", label: "Formateurs", children: [] },
  {
    href: "/admin/support",
    label: "Support",
    children: [
      { href: "/admin/support/tickets", label: "Tickets" },
      { href: "/admin/support/litiges", label: "Litiges" },
    ],
  },
  {
    href: "/admin/cours",
    label: "Cours",
    children: [
      { href: "/admin/cours/moderation", label: "À modérer" },
      { href: "/admin/cours/featured", label: "Mises en avant" },
    ],
  },
  {
    href: "/admin/moderation",
    label: "Modération",
    children: [
      { href: "/admin/moderation/signalements", label: "Signalements" },
      { href: "/admin/moderation/regles", label: "Règles" },
      { href: "/admin/moderation/historique", label: "Historique" },
    ],
  },
  {
    href: "/admin/parametres",
    label: "Paramètres",
    children: [
      { href: "/admin/parametres/branding", label: "Identité visuelle" },
      { href: "/admin/parametres/commerce", label: "Commerce" },
      { href: "/admin/parametres/emails", label: "Emails" },
      { href: "/admin/parametres/paiements", label: "Paiements" },
    ],
  },
  {
    href: "/admin/securite",
    label: "Sécurité",
    children: [
      { href: "/admin/securite/roles", label: "Rôles" },
      { href: "/admin/securite/sessions", label: "Sessions" },
      { href: "/admin/securite/logs", label: "Journaux de connexion" },
      { href: "/admin/securite/audit", label: "Piste d'audit" },
      { href: "/admin/securite/rgpd", label: "RGPD" },
    ],
  },
];

/**
 * Pages hors arborescence des sections : elles existent, sont liées depuis
 * ailleurs, mais n'appartiennent à aucun préfixe de section. Listées ici pour
 * rester joignables au ⌘K.
 */
export const ADMIN_STANDALONE_PAGES: AdminNavItem[] = [
  { href: "/admin/categories", label: "Catégories" },
  { href: "/admin/commissions", label: "Commissions" },
  { href: "/admin/codes-promo", label: "Codes promo (global)" },
  { href: "/admin/cms", label: "Pages CMS" },
];

/** Toutes les pages admin à plat — alimente la recherche du ⌘K. */
export const ADMIN_PAGES: AdminNavItem[] = [
  ...ADMIN_SECTIONS.flatMap((s) => [{ href: s.href, label: s.label }, ...s.children]),
  ...ADMIN_STANDALONE_PAGES,
];

/**
 * Section active pour un pathname donné.
 *
 * On retient le préfixe le PLUS LONG qui correspond : sans ça, `/admin` (qui
 * préfixe tout) gagnerait systématiquement. `/admin` n'est donc renvoyée que
 * pour une correspondance exacte.
 */
export function findAdminSection(pathname: string): AdminSection | null {
  let best: AdminSection | null = null;
  for (const section of ADMIN_SECTIONS) {
    const matches =
      pathname === section.href || pathname.startsWith(`${section.href}/`);
    if (matches && (!best || section.href.length > best.href.length)) {
      best = section;
    }
  }
  return best;
}
