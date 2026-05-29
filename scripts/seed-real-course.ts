// Crée une vraie formation publique pour tester le flow d'achat Stripe.
// - Catégorie : Développement
// - Instructeur : Awa Diallo (compte démo seedé)
// - Vidéos : 4 clips Pexels libres de droits (cache pexels-videos.json)
// - Prix : 19,90 € (assez bas pour tester sans hésiter, pas zéro pour
//          déclencher le vrai flow Stripe Checkout au lieu du free path)
//
// Idempotent : supprime le cours existant au slug fixe avant de recréer.
//
// Lancer :  npx tsx scripts/seed-real-course.ts

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { prisma } from "../src/lib/prisma";

const SLUG = "devenir-developpeur-web-2026";
const INSTRUCTOR_EMAIL = "formateur@e-formationgn.com";
const CATEGORY_SLUG = "developpement";

interface PexelsVideo {
  category: string;
  query: string;
  pexelsId: number;
  pageUrl: string;
  durationSeconds: number;
  thumbnail: string;
  author: string;
  authorUrl: string;
  videoFileHd: string;
  videoFileSd: string;
}

async function main() {
  const videos: PexelsVideo[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "pexels-videos.json"), "utf8"),
  );
  const techVideos = videos.filter((v) => v.category === "tech");
  if (techVideos.length < 4) {
    throw new Error(`Besoin de 4 vidéos tech, trouvé ${techVideos.length}.`);
  }

  const instructor = await prisma.user.findUnique({
    where: { email: INSTRUCTOR_EMAIL },
    select: { id: true, name: true },
  });
  if (!instructor) {
    throw new Error(
      `Instructeur ${INSTRUCTOR_EMAIL} introuvable. Lance d'abord npm run db:seed.`,
    );
  }

  const category = await prisma.category.findUnique({
    where: { slug: CATEGORY_SLUG },
    select: { id: true },
  });
  if (!category) throw new Error(`Catégorie ${CATEGORY_SLUG} introuvable.`);

  // Idempotence : delete + recreate (cascade Sections/Lessons via FK).
  await prisma.course.deleteMany({ where: { slug: SLUG } });

  const totalDuration = techVideos
    .slice(0, 4)
    .reduce((sum, v) => sum + v.durationSeconds, 0);

  const course = await prisma.course.create({
    data: {
      slug: SLUG,
      title: "Devenir développeur web — Guide 2026",
      subtitle:
        "Une introduction concrète au métier : outils, IA, sécurité et carrière en 2026.",
      description: `Bienvenue dans cette formation introductive. À travers 4 leçons vidéos courtes, tu vas comprendre :

- Ce que fait concrètement un développeur web aujourd'hui
- L'organisation d'une journée type et les outils incontournables
- Pourquoi la cybersécurité est devenue centrale
- Comment l'IA générative change le métier en 2026

Cette formation s'adresse aux personnes qui hésitent à se lancer ou qui veulent comprendre le quotidien avant d'investir dans un cursus long.`,
      thumbnailUrl: techVideos[0].thumbnail,
      promoVideoUrl: techVideos[0].videoFileHd,
      level: "BEGINNER",
      language: "FR",
      durationSeconds: totalDuration,
      // Prix volontairement bas pour faciliter les tests carte 4242.
      priceEUR: "19.90",
      priceUSD: "21.90",
      priceGNF: "200000", // ~20 € en GNF (1 € ≈ 10 000 GNF, ordre de grandeur réaliste)
      priceXOF: "13000", //  ~20 € en XOF (1 € ≈ 655,957 XOF)
      status: "PUBLISHED",
      publishedAt: new Date(),
      metaTitle: "Devenir développeur web en 2026 — Formation Gandal",
      metaDescription:
        "Découvrez le métier de développeur web : outils, IA, sécurité, journée type. 4 vidéos pour démarrer.",
      whatYouWillLearn: [
        "Le rôle d'un développeur web moderne",
        "Les outils du quotidien (éditeur, terminal, git)",
        "Les bases de la cybersécurité applicative",
        "L'impact de l'IA générative sur le métier",
      ],
      requirements: [
        "Aucun prérequis technique",
        "Une bonne connexion internet pour les vidéos",
      ],
      targetAudience: [
        "Personnes en reconversion professionnelle",
        "Étudiants curieux du métier",
        "Décideurs souhaitant comprendre la fonction tech",
      ],
      instructorId: instructor.id,
      categoryId: category.id,
      // Pas de mise en avant — on veut le retrouver dans le listing standard.
      isFeatured: false,
      sections: {
        create: [
          {
            title: "1. Découvrir le métier",
            description: "Vue d'ensemble : ce que fait un dév web en 2026.",
            displayOrder: 0,
            lessons: {
              create: [
                {
                  title: "Bienvenue — le développeur web aujourd'hui",
                  description:
                    "Aperçu du parcours et premier regard sur le métier.",
                  type: "VIDEO",
                  displayOrder: 0,
                  // Preview gratuite — incite à l'achat
                  isFreePreview: true,
                  externalVideoUrl: techVideos[0].videoFileHd,
                  videoDurationSeconds: techVideos[0].durationSeconds,
                  textContent: `Vidéo « ${techVideos[0].query} » par ${techVideos[0].author} (Pexels, libre de droits). Cette leçon donne un aperçu global avant d'entrer dans le détail.`,
                },
                {
                  title: "Une journée type — le poste de travail",
                  description:
                    "À quoi ressemble concrètement une journée de développement ?",
                  type: "VIDEO",
                  displayOrder: 1,
                  isFreePreview: false,
                  externalVideoUrl: techVideos[1].videoFileHd,
                  videoDurationSeconds: techVideos[1].durationSeconds,
                  textContent: `Vidéo « ${techVideos[1].query} » par ${techVideos[1].author} (Pexels). On observe ici la configuration courante d'un poste de développeur : double écran, IDE, terminal, navigateur, communication.`,
                },
              ],
            },
          },
          {
            title: "2. Les nouveaux enjeux",
            description: "Sécurité et IA — les deux compétences clés en 2026.",
            displayOrder: 1,
            lessons: {
              create: [
                {
                  title: "Cybersécurité — pourquoi tout dév doit la comprendre",
                  description:
                    "Tour d'horizon des menaces et des bonnes pratiques.",
                  type: "VIDEO",
                  displayOrder: 0,
                  isFreePreview: false,
                  externalVideoUrl: techVideos[2].videoFileHd,
                  videoDurationSeconds: techVideos[2].durationSeconds,
                  textContent: `Vidéo « ${techVideos[2].query} » par ${techVideos[2].author} (Pexels). Notions de base : XSS, SQL injection, secrets, principle of least privilege.`,
                },
                {
                  title: "L'IA dans le quotidien du dév en 2026",
                  description:
                    "Copilotes, code generation, agents — ce que ça change.",
                  type: "VIDEO",
                  displayOrder: 1,
                  isFreePreview: false,
                  externalVideoUrl: techVideos[3].videoFileHd,
                  videoDurationSeconds: techVideos[3].durationSeconds,
                  textContent: `Vidéo « ${techVideos[3].query} » par ${techVideos[3].author} (Pexels). L'IA générative est devenue un copilote permanent : on apprend à dialoguer avec, pas à la subir.`,
                },
              ],
            },
          },
        ],
      },
    },
  });

   
  console.log(`✅ Cours créé : /cours/${course.slug}  (id=${course.id})`);
   
  console.log(
    `   Prix : 19,90 €  ·  Durée : ${totalDuration}s  ·  Instructeur : ${instructor.name}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
