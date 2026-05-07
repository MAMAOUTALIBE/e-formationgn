import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL!),
});

async function main() {
  for (const q of ["next", "anglais", "marketing seo", "design ui", "python", "vidéo"]) {
    const totalRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "Course"
      WHERE "status" = 'PUBLISHED'
        AND "searchVector" @@ plainto_tsquery('french', ${q})
    `;
    const hits = await prisma.$queryRaw<Array<{ id: string; slug: string; rank: number }>>`
      SELECT id, slug,
             ts_rank_cd("searchVector", plainto_tsquery('french', ${q})) AS rank
      FROM "Course"
      WHERE "status" = 'PUBLISHED'
        AND "searchVector" @@ plainto_tsquery('french', ${q})
      ORDER BY rank DESC LIMIT 5
    `;
    console.log(`\n→ "${q}" — total=${totalRows[0]?.count}`);
    for (const h of hits) console.log(`   ${h.rank.toFixed(4)}  ${h.slug}`);
  }
}
main().finally(() => prisma.$disconnect());
