import Link from "next/link";
import { CheckCircle2, LockKeyhole, Mail } from "lucide-react";

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
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-md border border-[color:var(--brand-success)]/30 bg-[color:var(--brand-success)]/10 px-3 py-2.5 text-sm text-[color:var(--brand-success)]">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          <span className="font-medium">Cette formation vous est attribuée</span>
        </div>
        <Link
          href={`/apprentissage/${slug}`}
          className="inline-flex h-12 w-full items-center justify-center rounded-md bg-[#07883f] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#067437] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07883f] focus-visible:ring-offset-2"
        >
          Accéder à la formation
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 text-sm text-muted-foreground">
        <LockKeyhole className="mt-0.5 h-6 w-6 shrink-0 text-[#07883f]" aria-hidden />
        <div>
          <p className="text-base font-semibold text-foreground">
            Accès réservé aux apprenants inscrits
          </p>
          <p className="mt-2 leading-6">
            Contactez AIDUCA pour demander votre inscription à cette formation.
          </p>
        </div>
      </div>
      <Link
        href="/contact"
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#07883f] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#067437] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07883f] focus-visible:ring-offset-2"
      >
        <Mail className="h-5 w-5" aria-hidden />
        Demander mon inscription
      </Link>
    </div>
  );
}
