// Liste les comptes qui ont accès à /admin (rôles ADMIN/MODERATOR/SUPPORT/FINANCE).
// Lancer : npx tsx scripts/list-admins.ts

import "dotenv/config";

import { prisma } from "../src/lib/prisma";

async function main() {
  const all = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, status: true },
    orderBy: { createdAt: "desc" },
  });
  console.log(`Total users: ${all.length}`);
  console.log();

  const admins = all.filter((u) =>
    ["ADMIN", "MODERATOR", "SUPPORT", "FINANCE"].includes(u.role),
  );
  console.log("=== Comptes avec accès /admin ===");
  if (admins.length === 0) {
    console.log("⚠ AUCUN compte admin trouvé.");
    console.log("→ Pour créer un admin, lance :");
    console.log("   npx tsx scripts/make-admin.ts <email>");
  } else {
    admins.forEach((u) =>
      console.log(
        `  [${u.role.padEnd(9)}] ${u.email.padEnd(40)} ${u.status.padEnd(20)} ${u.name ?? "-"}`,
      ),
    );
  }
  console.log();

  console.log("=== 10 comptes les plus récents ===");
  all
    .slice(0, 10)
    .forEach((u) =>
      console.log(
        `  [${u.role.padEnd(9)}] ${u.email.padEnd(40)} ${u.status.padEnd(20)} ${u.name ?? "-"}`,
      ),
    );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("ERR:", e);
  process.exit(1);
});
