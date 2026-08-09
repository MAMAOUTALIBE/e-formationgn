import Link from "next/link";

/**
 * Barre de pied de page d'un espace de travail.
 *
 * Volontairement mince (h-10) : dans la coquille figée du layout, chaque pixel
 * pris ici est un pixel en moins pour la zone de contenu, qui est la seule à
 * défiler. On s'en tient donc à une ligne d'informations de contexte.
 */
export function WorkspaceFooter({
  label,
  role,
  settingsHref,
}: {
  /** Nom de l'espace — « CRM admin », « Espace formateur »… */
  label: string;
  role: string;
  /** Lien « Paramètres » du pied de page. Absent = lien masqué. */
  settingsHref?: string;
}) {
  return (
    <footer className="workspace-footer flex h-10 shrink-0 items-center justify-between gap-4 border-t border-[color:var(--admin-footer-border,var(--border))] bg-[color:var(--admin-footer-bg,var(--background))] px-4 text-xs text-[color:var(--admin-footer-muted,var(--muted-foreground))] lg:px-6">
      <p className="truncate">
        <span className="font-medium text-[color:var(--admin-footer-fg,var(--foreground))]">
          Gandal
        </span>
        <span className="mx-1.5 text-border">·</span>
        {label}
        <span className="mx-1.5 hidden text-border sm:inline">·</span>
        <span className="hidden sm:inline">Connecté en {role}</span>
      </p>

      <nav className="flex shrink-0 items-center gap-4" aria-label="Liens de pied de page">
        <Link href="/" className="transition-colors hover:text-foreground">
          Voir le site
        </Link>
        {settingsHref ? (
          <Link
            href={settingsHref}
            className="hidden transition-colors hover:text-foreground sm:inline"
          >
            Paramètres
          </Link>
        ) : null}
      </nav>
    </footer>
  );
}
