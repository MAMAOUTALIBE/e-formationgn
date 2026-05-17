// Crée (ou réinitialise) un compte étudiant test :
//   email   : eleve@test.gandal
//   mdp     : Test1234!
// Email pré-vérifié, statut ACTIVE → utilisable immédiatement pour tester
// le checkout Stripe sans passer par la vérif email Resend.
//
// Lancer :  npx tsx scripts/seed-test-student.ts

import "dotenv/config";
import bcrypt from "bcryptjs";

import { prisma } from "../src/lib/prisma";

const EMAIL = "eleve@test.gandal";
const PASSWORD = "Test1234!";

async function main() {
  const hashedPassword = await bcrypt.hash(PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {
      hashedPassword,
      emailVerified: new Date(),
      status: "ACTIVE",
      passwordChangedAt: new Date(),
    },
    create: {
      email: EMAIL,
      hashedPassword,
      name: "Élève Test",
      firstName: "Élève",
      lastName: "Test",
      emailVerified: new Date(),
      status: "ACTIVE",
      role: "STUDENT",
      preferredCurrency: "EUR",
      passwordChangedAt: new Date(),
    },
    select: { id: true, email: true, role: true, status: true },
  });

  // eslint-disable-next-line no-console
  console.log(`✅ Compte test prêt :`);
  console.log(`   email : ${user.email}`);
  console.log(`   mdp   : ${PASSWORD}`);
  console.log(`   id    : ${user.id}`);
  console.log(`   rôle  : ${user.role}  ·  statut : ${user.status}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
