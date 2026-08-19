// Requête publique : formateurs mis en avant sur la page d'accueil.
// Sélectionne les formateurs ayant au moins un cours publié, classés par
// nombre de cours, avec de quoi afficher une carte (avatar, nom, accroche).

import { prisma } from "@/lib/prisma";

export interface FeaturedInstructor {
  id: string;
  name: string;
  headline: string | null;
  image: string | null;
  affiliateCode: string | null;
  courseCount: number;
}

export async function listFeaturedInstructors(
  take = 4,
): Promise<FeaturedInstructor[]> {
  const rows = await prisma.user.findMany({
    where: {
      isInstructor: true,
      coursesAuthored: { some: { status: "PUBLISHED" } },
    },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      headline: true,
      image: true,
      affiliateCode: true,
      _count: {
        select: { coursesAuthored: { where: { status: "PUBLISHED" } } },
      },
    },
    orderBy: { coursesAuthored: { _count: "desc" } },
    take,
  });

  return rows.map((r) => ({
    id: r.id,
    name:
      r.name ??
      ([r.firstName, r.lastName].filter(Boolean).join(" ") || "Formateur Aiduca"),
    headline: r.headline,
    image: r.image,
    affiliateCode: r.affiliateCode,
    courseCount: r._count.coursesAuthored,
  }));
}
