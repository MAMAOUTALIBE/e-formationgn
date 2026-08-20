// Synchronisation contrôlée des pages CMS publiques avec les textes de
// référence du mode centre_formation.
//
// Par défaut, le script est en lecture seule :
//   npx tsx scripts/sync-center-cms.ts
//
// L'écriture exige deux arguments explicites :
//   npx tsx scripts/sync-center-cms.ts --apply --confirm=SYNC_CENTER_CMS
//
// Seules les pages déjà publiées sont mises à jour. Les brouillons et les
// pages absentes restent sous le contrôle éditorial de l'administration.

import "dotenv/config";

import { CMS_REFERENCE_CONTENT } from "../src/lib/cms";
import { prisma } from "../src/lib/prisma";

const TARGET_SLUGS = ["cgv", "confidentialite", "cookies", "a-propos"] as const;
const APPLY_CONFIRMATION = "--confirm=SYNC_CENTER_CMS";

async function main() {
  const apply = process.argv.includes("--apply");
  const confirmed = process.argv.includes(APPLY_CONFIRMATION);

  if (apply && !confirmed) {
    throw new Error(`Écriture refusée : ajoutez ${APPLY_CONFIRMATION}.`);
  }

  const pages = await prisma.cmsPage.findMany({
    where: { slug: { in: [...TARGET_SLUGS] } },
    select: { slug: true, title: true, body: true, isPublished: true },
  });
  const pagesBySlug = new Map(pages.map((page) => [page.slug, page]));

  for (const slug of TARGET_SLUGS) {
    const reference = CMS_REFERENCE_CONTENT[slug];
    const current = pagesBySlug.get(slug);

    if (!reference) throw new Error(`Contenu de référence absent : ${slug}`);
    if (!current) {
      console.log(`[absente] ${slug} — le fallback applicatif reste utilisé`);
      continue;
    }
    if (!current.isPublished) {
      console.log(`[brouillon ignoré] ${slug}`);
      continue;
    }
    if (current.title === reference.title && current.body === reference.body) {
      console.log(`[à jour] ${slug}`);
      continue;
    }
    if (!apply) {
      console.log(`[à synchroniser] ${slug}`);
      continue;
    }

    await prisma.cmsPage.update({
      where: { slug },
      data: { title: reference.title, body: reference.body },
    });
    console.log(`[synchronisée] ${slug}`);
  }

  if (!apply) {
    console.log(`Lecture seule. Pour appliquer : --apply ${APPLY_CONFIRMATION}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Erreur CMS inconnue");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
