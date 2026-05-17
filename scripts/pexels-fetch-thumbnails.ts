// Récupère une photo Pexels par cours publié et met à jour
// `Course.thumbnailUrl` directement en base.
//
// Usage :
//   PEXELS_API_KEY=xxx npx tsx scripts/pexels-fetch-thumbnails.ts
//   PEXELS_API_KEY=xxx npx tsx scripts/pexels-fetch-thumbnails.ts --force   # remplace même les vignettes existantes
//
// Requiert : PEXELS_API_KEY (https://www.pexels.com/api/) + DATABASE_URL.

import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const API_KEY = process.env.PEXELS_API_KEY;
if (!API_KEY) {
  console.error("PEXELS_API_KEY manquant. Voir https://www.pexels.com/api/.");
  process.exit(1);
}

const FORCE = process.argv.includes("--force");

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL!),
});

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  alt: string | null;
  photographer: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    landscape: string;
    portrait: string;
  };
}

interface PexelsSearchResponse {
  photos: PexelsPhoto[];
  total_results: number;
}

/**
 * Mots-clés Pexels par catégorie. Le slug court de la catégorie est mappé
 * sur une requête générique visuellement adaptée. La requête finale combine
 * cette base + des mots issus du slug du cours pour affiner.
 */
const CATEGORY_QUERIES: Record<string, string> = {
  developpement: "programming code laptop",
  "design-ux": "ui ux design figma desk",
  "design-graphique": "graphic design illustration",
  business: "team meeting office",
  marketing: "social media marketing laptop",
  "marketing-digital": "digital marketing analytics",
  langues: "english books learning",
  productivite: "productivity desk planner",
  data: "data analytics dashboard",
  ia: "artificial intelligence neural network",
  finance: "finance charts trading",
  photo: "photographer studio camera",
  video: "video editing studio",
  musique: "music studio audio",
};

/** Mots-clés tirés du slug du cours pour affiner la recherche. */
function slugKeywords(slug: string): string {
  // ex: "next-js-fondamentaux" → "next js fondamentaux"
  return slug
    .replace(/-/g, " ")
    .replace(/\bla\b|\bles\b|\bdu\b|\bde\b|\bedition\b|\d{4}/gi, "")
    .trim();
}

function buildQuery(courseSlug: string, categorySlug: string): string {
  const base = CATEGORY_QUERIES[categorySlug] ?? "online learning";
  const keywords = slugKeywords(courseSlug).split(/\s+/).slice(0, 3).join(" ");
  return `${keywords} ${base}`.trim();
}

async function searchOne(query: string): Promise<PexelsPhoto | null> {
  const url = `https://api.pexels.com/v1/search?per_page=5&orientation=landscape&query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { Authorization: API_KEY ?? "" },
  });
  if (!response.ok) {
    console.error(`[pexels] "${query}" → HTTP ${response.status}`);
    return null;
  }
  const data = (await response.json()) as PexelsSearchResponse;
  // On prend la première photo paysage; toutes le sont déjà via le filtre.
  return data.photos[0] ?? null;
}

async function main() {
  const courses = await prisma.course.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      thumbnailUrl: true,
      category: { select: { slug: true, name: true } },
    },
    orderBy: { publishedAt: "desc" },
  });

  console.log(`📚 ${courses.length} cours publiés trouvés. FORCE=${FORCE}`);
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const course of courses) {
    if (course.thumbnailUrl && !FORCE) {
      console.log(`⏭  ${course.slug} (vignette déjà présente)`);
      skipped++;
      continue;
    }

    const query = buildQuery(course.slug, course.category.slug);
    const photo = await searchOne(query);
    if (!photo) {
      console.warn(`⚠  ${course.slug} : aucune photo pour "${query}"`);
      failed++;
      continue;
    }

    // `large` = 940x650 environ, parfait pour des vignettes 16:9 sans
    // payer le coût d'une original 4000px.
    const thumbnailUrl = photo.src.large;

    await prisma.course.update({
      where: { id: course.id },
      data: { thumbnailUrl },
    });
    console.log(
      `✅ ${course.slug} ← ${photo.photographer} (${photo.id}) "${query}"`,
    );
    updated++;

    // throttle Pexels (200 req/h gratuit)
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log(
    `\nRésumé : ${updated} mis à jour, ${skipped} ignorés, ${failed} échecs sur ${courses.length}.`,
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
