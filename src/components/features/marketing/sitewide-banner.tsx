// Bannière sitewide affichée en haut du site public.
// Server Component : lit la première bannière active dans la fenêtre temporelle.
// Si plusieurs sont actives, on prend la plus récente. Pas de cache cible —
// les bannières changent peu souvent, l'overhead est minimal (1 requête
// `findFirst` par page render).

import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

const KIND_STYLES: Record<string, string> = {
  INFO: "bg-[color:var(--brand-secondary)] text-white",
  PROMO: "bg-[color:var(--brand-mint)] text-[color:var(--neutral-900)]",
  WARNING: "bg-amber-500 text-white",
};

export async function SitewideBanner() {
  const now = new Date();
  const banner = await prisma.sitewideBanner.findFirst({
    where: {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  if (!banner) return null;

  const tone = KIND_STYLES[banner.kind] ?? KIND_STYLES.INFO;

  return (
    <div className={cn("w-full px-4 py-2 text-center text-sm font-medium", tone)}>
      <span>{banner.message}</span>
      {banner.ctaUrl ? (
        <>
          {" "}
          <Link
            href={banner.ctaUrl}
            className="ml-2 inline-block underline underline-offset-2 hover:no-underline"
          >
            {banner.ctaLabel ?? "En savoir plus"} →
          </Link>
        </>
      ) : null}
    </div>
  );
}
