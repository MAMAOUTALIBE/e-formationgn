// Comptes de démonstration pour la recette QA (audit fonctionnel des 3 rôles).
//
// Idempotent, et refuse de s'exécuter ailleurs que sur une base locale : ces
// comptes ont un mot de passe connu et publié dans le dépôt, les poser sur une
// base accessible reviendrait à y ouvrir un accès administrateur.
//
//   npx tsx scripts/seed-qa-accounts.ts

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1|host\.docker\.internal|db)[:/]/.test(url)) {
  throw new Error(
    "Refus : DATABASE_URL ne pointe pas vers une base locale. " +
      "Ces comptes de recette ont un mot de passe public.",
  );
}
if (process.env.NODE_ENV === "production") {
  throw new Error("Refus : NODE_ENV=production.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg(url) });

/** Mot de passe unique des comptes de recette — jamais utilisé hors local. */
export const QA_PASSWORD = "AuditQA2026!";

const ACCOUNTS = [
  { email: "qa.eleve@audit.local", role: "STUDENT", first: "QA", last: "Élève" },
  { email: "qa.formateur@audit.local", role: "INSTRUCTOR", first: "QA", last: "Formateur" },
  // Second formateur : sans lui, aucun test ne peut vérifier qu'un formateur
  // reste enfermé dans ses propres formations.
  { email: "qa.formateur2@audit.local", role: "INSTRUCTOR", first: "QA", last: "Formateur Deux" },
  { email: "qa.admin@audit.local", role: "ADMIN", first: "QA", last: "Admin" },
] as const;

/** Une formation publiée par formateur, pour les contrôles de cloisonnement. */
const COURSES = [
  { slug: "qa-formation-formateur-un", title: "QA — Formation du formateur un", owner: "qa.formateur@audit.local" },
  { slug: "qa-formation-formateur-deux", title: "QA — Formation du formateur deux", owner: "qa.formateur2@audit.local" },
] as const;

async function main(): Promise<void> {
  const hashedPassword = await bcrypt.hash(QA_PASSWORD, 10);
  for (const account of ACCOUNTS) {
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        role: account.role,
        hashedPassword,
        passwordChangedAt: null,
        emailVerified: new Date(),
        status: "ACTIVE",
        mustChangePassword: false,
        isInstructor: account.role === "INSTRUCTOR",
      },
      create: {
        email: account.email,
        role: account.role,
        hashedPassword,
        emailVerified: new Date(),
        status: "ACTIVE",
        name: `${account.first} ${account.last}`,
        firstName: account.first,
        lastName: account.last,
        isInstructor: account.role === "INSTRUCTOR",
      },
    });
    console.log(`✓ ${account.role.padEnd(11)} ${account.email}  id=${user.id}`);
  }
  // `categoryId` est requis sur Course : sans catégorie en base, les cours de
  // recette ne peuvent pas exister — mieux vaut le dire que produire un seed
  // partiel dont les tests dénonceraient ensuite l'absence de données.
  const category = await prisma.category.findFirst({ select: { id: true } });
  if (!category) {
    throw new Error("Aucune catégorie en base : lancez d'abord « npm run db:seed ».");
  }
  for (const course of COURSES) {
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: course.owner },
      select: { id: true },
    });
    const record = await prisma.course.upsert({
      where: { slug: course.slug },
      update: { instructorId: owner.id, status: "PUBLISHED" },
      create: {
        slug: course.slug,
        title: course.title,
        description: "Formation de recette — audit QA. Aucune donnée réelle.",
        instructorId: owner.id,
        status: "PUBLISHED",
        publishedAt: new Date(),
        categoryId: category.id,
      },
      select: { id: true, slug: true },
    });
    // Une section et une leçon : sans contenu, aucun contrôle d'accès aux
    // leçons n'est observable.
    const section = await prisma.section.upsert({
      where: { id: `${record.id}-qa-section` },
      update: {},
      create: { id: `${record.id}-qa-section`, courseId: record.id, title: "Module de recette", displayOrder: 1 },
      select: { id: true },
    });
    await prisma.lesson.upsert({
      where: { id: `${record.id}-qa-lesson` },
      update: {},
      create: {
        id: `${record.id}-qa-lesson`,
        sectionId: section.id,
        title: "Leçon de recette",
        displayOrder: 1,
        isFreePreview: false,
      },
    });
    console.log(`✓ COURS       /cours/${record.slug}  (${course.owner})`);
  }

  console.log(
    `\nUtilisateurs: ${await prisma.user.count()} | Cours: ${await prisma.course.count()}`,
  );
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
