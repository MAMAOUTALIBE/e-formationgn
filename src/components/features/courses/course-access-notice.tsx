import Link from "next/link";
import { CheckCircle2, Lock } from "lucide-react";

/**
 * Remplace le bloc prix / achat en mode centre de formation.
 *
 * Le catalogue reste entièrement visible : l'élève doit pouvoir voir ce que le
 * centre propose. Seul l'accès au contenu est conditionné à une attribution,
 * et c'est ce que ce bloc indique sans détour — plutôt qu'un prix et un bouton
 * « Acheter » qui n'aboutiraient nulle part.
 */
export function CourseAccessNotice({
  alreadyEnrolled,
  slug,
}: {
  alreadyEnrolled: boolean;
  slug: string;
}) {
  if (alreadyEnrolled) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-md border border-[color:var(--brand-success)]/30 bg-[color:var(--brand-success)]/10 px-3 py-2.5 text-sm text-[color:var(--brand-success)]">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          <span className="font-medium">Cette formation vous est attribuée</span>
        </div>
        <Link
          href={`/apprentissage/${slug}`}
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[color:var(--brand-secondary)] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Accéder à la formation
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div>
          <p className="font-medium text-foreground">Formation non attribuée</p>
          <p className="mt-1">
            L&apos;accès est ouvert par le centre de formation. Rapprochez-vous du
            secrétariat pour être inscrit à cette formation.
          </p>
        </div>
      </div>
    </div>
  );
}
