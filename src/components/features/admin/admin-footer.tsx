import Link from "next/link";

/**
 * Barre de pied de page du CRM admin.
 *
 * Volontairement mince (h-10) : dans la coquille figée du layout admin, chaque
 * pixel pris ici est un pixel en moins pour la zone de contenu, qui est la
 * seule à défiler. On s'en tient donc à une ligne d'informations de contexte.
 */
export function AdminFooter({ role }: { role: string }) {
  return (
    <footer className="flex h-10 shrink-0 items-center justify-between gap-4 border-t border-border bg-background px-4 text-xs text-muted-foreground lg:px-6">
      <p className="truncate">
        <span className="font-medium text-foreground">Gandal</span>
        <span className="mx-1.5 text-border">·</span>
        CRM admin
        <span className="mx-1.5 hidden text-border sm:inline">·</span>
        <span className="hidden sm:inline">Connecté en {role}</span>
      </p>

      <nav className="flex shrink-0 items-center gap-4" aria-label="Liens de pied de page">
        <Link href="/" className="transition-colors hover:text-foreground">
          Voir le site
        </Link>
        <Link href="/admin/parametres" className="hidden transition-colors hover:text-foreground sm:inline">
          Paramètres
        </Link>
      </nav>
    </footer>
  );
}
