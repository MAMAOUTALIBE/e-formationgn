// Seed démo : crée un étudiant inscrit au cours "Blender" (qui utilise des
// externalVideoUrl publiques, lisibles sans Mux) afin de tester de bout en
// bout le lecteur de leçon, la progression et la génération de certificat.
//
// Idempotent : ré-exécutable sans danger (upsert + skipDuplicates).
//
//   npx tsx scripts/seed-demo-student.ts

import bcrypt from "bcryptjs";
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://placeholder@localhost:5432/placeholder";

const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) });

const STUDENT_EMAIL = "etudiant@e-formationgn.com";
const STUDENT_PASSWORD = "Demo1234!";
const COURSE_SLUG = "blender-open-movies-decouverte";

async function main() {
  const course = await prisma.course.findUnique({
    where: { slug: COURSE_SLUG },
    select: { id: true, title: true },
  });
  if (!course) {
    throw new Error(
      `Cours "${COURSE_SLUG}" introuvable. Lance d'abord: npm run db:seed`,
    );
  }

  const hashedPassword = await bcrypt.hash(STUDENT_PASSWORD, 12);
  const student = await prisma.user.upsert({
    where: { email: STUDENT_EMAIL },
    update: {},
    create: {
      email: STUDENT_EMAIL,
      hashedPassword,
      name: "Awa Étudiante",
      firstName: "Awa",
      lastName: "Étudiante",
      role: "STUDENT",
      status: "ACTIVE",
      emailVerified: new Date(),
    },
    select: { id: true },
  });

  const enrollment = await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: student.id, courseId: course.id } },
    update: {},
    create: {
      userId: student.id,
      courseId: course.id,
      source: "ADMIN_GRANT",
      progressPercent: 0,
    },
    select: { id: true },
  });

  console.log("✅ Étudiant démo prêt.");
  console.log(`   Email      : ${STUDENT_EMAIL}`);
  console.log(`   Mot de passe : ${STUDENT_PASSWORD}`);
  console.log(`   Inscrit à  : ${course.title} (enrollment ${enrollment.id})`);
  console.log(`   Ouvre      : http://localhost:3000/apprentissage/${COURSE_SLUG}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
