// Registre de navigation de l'espace admin.
//
// Chaque section déclare les rôles qui la voient. Ce filtrage est
// COSMÉTIQUE — il désencombre le menu d'un rôle des écrans qui ne le
// concernent pas. Il ne protège rien : l'autorité reste
// `authConfig.callbacks.authorized` pour les routes et les helpers de
// src/lib/auth/authorization.ts pour les actions. Un rôle qui taperait l'URL
// d'un écran absent de son menu est arrêté là, pas ici.

import type { WorkspaceNavigation } from "@/lib/workspace/navigation";

const ALL_ADMIN = ["ADMIN", "MODERATOR", "SUPPORT", "FINANCE", "MANAGER"] as const;
// Périmètre du gestionnaire de formation : sociétés, élèves, formations et
// sessions — il est présent dans COMMUNITY_SIDE et CATALOG_SIDE. Il reste
// tenu à l'écart des finances, de la sécurité et de la configuration : son
// métier est le suivi pédagogique et administratif.
const FINANCE_SIDE = ["ADMIN", "FINANCE"] as const;
const COMMUNITY_SIDE = ["ADMIN", "SUPPORT", "MODERATOR", "MANAGER"] as const;
const MODERATION_SIDE = ["ADMIN", "MODERATOR"] as const;
/// Catalogue pédagogique : le modérateur y veille, le gestionnaire y compose.
const CATALOG_SIDE = ["ADMIN", "MODERATOR", "MANAGER"] as const;
const SUPPORT_SIDE = ["ADMIN", "SUPPORT"] as const;
/** Configuration et sécurité : réservées à l'administrateur complet. */
const ADMIN_ONLY = ["ADMIN"] as const;

export const ADMIN_NAV: WorkspaceNavigation = {
  id: "admin",
  label: "CRM admin",
  homeHref: "/",
  groups: [
    { id: "pilotage", label: "Pilotage business" },
    { id: "communaute", label: "Gestion communauté" },
    { id: "catalogue", label: "Catalogue et qualité" },
    { id: "configuration", label: "Configuration" },
  ],
  sections: [
    {
      href: "/admin",
      label: "Tableau de bord",
      icon: "gauge",
      roles: ALL_ADMIN,
      children: [],
    },
    {
      href: "/admin/analytics",
      label: "Analytics",
      icon: "chart",
      group: "pilotage",
      roles: FINANCE_SIDE,
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
      icon: "wallet",
      group: "pilotage",
      roles: FINANCE_SIDE,
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
      icon: "megaphone",
      group: "pilotage",
      roles: ADMIN_ONLY,
      children: [
        { href: "/admin/marketing/promotions", label: "Promotions" },
        { href: "/admin/marketing/codes-promo", label: "Codes promo" },
        { href: "/admin/marketing/campagnes-email", label: "Campagnes email" },
        { href: "/admin/marketing/affiliation", label: "Affiliation" },
        { href: "/admin/marketing/seo", label: "SEO" },
      ],
    },
    {
      href: "/admin/societes",
      label: "Sociétés",
      icon: "building",
      group: "communaute",
      roles: COMMUNITY_SIDE,
      children: [{ href: "/admin/societes/nouvelle", label: "Nouvelle société" }],
    },
    {
      href: "/admin/utilisateurs",
      label: "Utilisateurs",
      icon: "users",
      group: "communaute",
      roles: COMMUNITY_SIDE,
      children: [],
    },
    {
      href: "/admin/formateurs",
      label: "Formateurs",
      icon: "graduation",
      group: "communaute",
      roles: ALL_ADMIN,
      children: [],
    },
    {
      href: "/admin/support",
      label: "Support",
      icon: "lifebuoy",
      group: "communaute",
      roles: SUPPORT_SIDE,
      badgeKeys: ["openTickets", "openDisputes"],
      children: [
        { href: "/admin/support/tickets", label: "Tickets" },
        { href: "/admin/support/litiges", label: "Litiges" },
      ],
    },
    {
      href: "/admin/formations",
      label: "Formations",
      icon: "certificate",
      group: "catalogue",
      roles: CATALOG_SIDE,
      children: [{ href: "/admin/formations/nouvelle", label: "Nouvelle formation" }],
    },
    {
      href: "/admin/cours",
      label: "Cours",
      icon: "book",
      group: "catalogue",
      roles: CATALOG_SIDE,
      badgeKeys: ["pendingCourses"],
      children: [
        { href: "/admin/cours/moderation", label: "À modérer" },
        { href: "/admin/cours/featured", label: "Mises en avant" },
      ],
    },
    {
      href: "/admin/moderation",
      label: "Modération",
      icon: "alert",
      group: "catalogue",
      roles: MODERATION_SIDE,
      badgeKeys: ["pendingReports"],
      children: [
        { href: "/admin/moderation/signalements", label: "Signalements" },
        { href: "/admin/moderation/regles", label: "Règles" },
        { href: "/admin/moderation/historique", label: "Historique" },
      ],
    },
    {
      href: "/admin/parametres",
      label: "Paramètres",
      icon: "settings",
      group: "configuration",
      roles: ADMIN_ONLY,
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
      icon: "shield",
      group: "configuration",
      roles: ADMIN_ONLY,
      badgeKeys: ["pendingGdpr"],
      children: [
        { href: "/admin/securite/roles", label: "Rôles" },
        { href: "/admin/securite/sessions", label: "Sessions" },
        { href: "/admin/securite/logs", label: "Journaux de connexion" },
        { href: "/admin/securite/audit", label: "Piste d'audit" },
        { href: "/admin/securite/rgpd", label: "RGPD" },
      ],
    },
  ],
  standalonePages: [
    { href: "/admin/categories", label: "Catégories" },
    { href: "/admin/commissions", label: "Commissions" },
    { href: "/admin/codes-promo", label: "Codes promo (global)" },
    { href: "/admin/cms", label: "Pages CMS" },
  ],
};
