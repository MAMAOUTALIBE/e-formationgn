// Seed Prisma — alimente la base avec des catégories, un formateur de
// démonstration et quelques cours publiés. Idempotent : on utilise des slugs
// stables comme clés `upsert`. Re-lancer le seed est sûr.
//
// Lancement manuel :
//   npx tsx prisma/seed.ts

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://placeholder@localhost:5432/placeholder";

const prisma = new PrismaClient({
  adapter: new PrismaPg(connectionString),
});

interface CategorySeed {
  slug: string;
  name: string;
  description: string;
  iconName: string;
  displayOrder: number;
}

const CATEGORIES: CategorySeed[] = [
  {
    slug: "developpement",
    name: "Développement",
    description: "Web, mobile, data, devops — tous les langages et frameworks.",
    iconName: "Code",
    displayOrder: 1,
  },
  {
    slug: "design",
    name: "Design & UX",
    description: "UI, UX, branding, illustrations, motion design.",
    iconName: "Palette",
    displayOrder: 2,
  },
  {
    slug: "business",
    name: "Business & Entrepreneuriat",
    description: "Création d'entreprise, gestion, marketing, vente.",
    iconName: "Briefcase",
    displayOrder: 3,
  },
  {
    slug: "marketing",
    name: "Marketing digital",
    description: "SEO, publicité, content marketing, réseaux sociaux.",
    iconName: "Megaphone",
    displayOrder: 4,
  },
  {
    slug: "langues",
    name: "Langues",
    description: "Apprenez l'anglais, l'espagnol, l'allemand et plus encore.",
    iconName: "Languages",
    displayOrder: 5,
  },
  {
    slug: "developpement-personnel",
    name: "Développement personnel",
    description: "Productivité, communication, leadership, bien-être.",
    iconName: "Sprout",
    displayOrder: 6,
  },
  {
    slug: "photographie-video",
    name: "Photographie & vidéo",
    description: "Prise de vue, retouche, montage, storytelling visuel.",
    iconName: "Camera",
    displayOrder: 7,
  },
  {
    slug: "musique",
    name: "Musique & Audio",
    description: "MAO, mixage, instrument, théorie musicale.",
    iconName: "Music",
    displayOrder: 8,
  },
];

async function ensureCommissionRates() {
  await prisma.commissionRate.upsert({
    where: { source: "INSTRUCTOR_DRIVEN" },
    update: { rateBps: 1500 },
    create: {
      source: "INSTRUCTOR_DRIVEN",
      rateBps: 1500,
      description: "Vente initiée par le formateur (lien d'affiliation, audience).",
    },
  });
  await prisma.commissionRate.upsert({
    where: { source: "PLATFORM_DRIVEN" },
    update: { rateBps: 3000 },
    create: {
      source: "PLATFORM_DRIVEN",
      rateBps: 3000,
      description: "Vente initiée par la plateforme (recherche, recommandations, marketing).",
    },
  });
}

async function ensureCategories() {
  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        iconName: category.iconName,
        displayOrder: category.displayOrder,
        isActive: true,
      },
      create: {
        slug: category.slug,
        name: category.name,
        description: category.description,
        iconName: category.iconName,
        displayOrder: category.displayOrder,
      },
    });
  }
}

async function ensureDemoInstructor() {
  const email = "formateur@e-formationgn.com";
  const hashedPassword = await bcrypt.hash("Demo1234!", 12);
  return prisma.user.upsert({
    where: { email },
    update: {
      role: "INSTRUCTOR",
      isInstructor: true,
      status: "ACTIVE",
      emailVerified: new Date(),
    },
    create: {
      email,
      hashedPassword,
      firstName: "Awa",
      lastName: "Diallo",
      name: "Awa Diallo",
      headline: "Développeuse full-stack & formatrice",
      bio:
        "Awa enseigne le développement web depuis 8 ans. Elle a accompagné plus de\n" +
        "5 000 élèves dans leur reconversion vers les métiers du numérique.",
      role: "INSTRUCTOR",
      isInstructor: true,
      status: "ACTIVE",
      emailVerified: new Date(),
      affiliateCode: "awa-diallo",
    },
  });
}

interface CourseSeed {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  categorySlug: string;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "ALL_LEVELS";
  priceEUR: number;
  priceUSD: number;
  durationSeconds: number;
  averageRating: number;
  totalRatings: number;
  totalEnrollments: number;
  whatYouWillLearn: string[];
  requirements: string[];
  targetAudience: string[];
  sections: Array<{
    title: string;
    lessons: Array<{
      title: string;
      durationSeconds: number;
      isFreePreview?: boolean;
      type?: "VIDEO" | "TEXT" | "QUIZ" | "RESOURCE";
      /** URL .mp4 publique (CC). Permet de tester le player sans Mux. */
      externalVideoUrl?: string;
    }>;
  }>;
  /** Mention de licence à afficher (cours basé sur contenu CC). */
  licenseAttribution?: string;
}

const COURSES: CourseSeed[] = [
  {
    slug: "nextjs-fondamentaux-2026",
    title: "Next.js : les fondamentaux (édition 2026)",
    subtitle:
      "Construisez une application web moderne avec Next.js, React Server Components et TypeScript.",
    description:
      "Vous découvrirez l'App Router, les Server Components, les Server Actions, le streaming, le SEO, l'authentification et le déploiement sur Vercel. Ce cours complet est conçu pour vous emmener du « Hello World » jusqu'à une mise en production sereine.",
    categorySlug: "developpement",
    level: "INTERMEDIATE",
    priceEUR: 49.9,
    priceUSD: 54.9,
    durationSeconds: 5 * 3600 + 30 * 60,
    averageRating: 4.7,
    totalRatings: 312,
    totalEnrollments: 2480,
    whatYouWillLearn: [
      "Maîtriser l'App Router et les Server Components",
      "Mettre en place une authentification sécurisée",
      "Optimiser les performances et le SEO",
      "Déployer en production sur Vercel",
    ],
    requirements: ["Bases de JavaScript et React"],
    targetAudience: ["Développeurs web", "Personnes en reconversion"],
    sections: [
      {
        title: "Introduction",
        lessons: [
          { title: "Bienvenue dans le cours", durationSeconds: 180, isFreePreview: true },
          { title: "Le projet final", durationSeconds: 240, isFreePreview: true },
          { title: "Mettre en place l'environnement", durationSeconds: 480 },
        ],
      },
      {
        title: "Premiers pas avec Next.js",
        lessons: [
          { title: "App Router : structure", durationSeconds: 540 },
          { title: "Layouts et pages", durationSeconds: 600 },
          { title: "Routing dynamique", durationSeconds: 720 },
        ],
      },
      {
        title: "Server Components et données",
        lessons: [
          { title: "Server Components vs Client", durationSeconds: 660 },
          { title: "Fetch et caching", durationSeconds: 720 },
          { title: "Server Actions", durationSeconds: 840 },
          { title: "Quiz : Server Components", durationSeconds: 0, type: "QUIZ" },
        ],
      },
      {
        title: "Mise en production",
        lessons: [
          { title: "SEO et métadonnées", durationSeconds: 480 },
          { title: "Déploiement Vercel", durationSeconds: 540 },
        ],
      },
    ],
  },
  {
    slug: "design-ui-debutant",
    title: "Design UI : démarrer du bon pied",
    subtitle:
      "Apprenez les principes essentiels du design d'interface : grille, typographie, couleurs, hiérarchie.",
    description:
      "Un cours pratique pour les développeurs et créateurs de produit qui veulent dessiner des interfaces propres et professionnelles, sans formation préalable en design.",
    categorySlug: "design",
    level: "BEGINNER",
    priceEUR: 29.9,
    priceUSD: 32.9,
    durationSeconds: 3 * 3600,
    averageRating: 4.5,
    totalRatings: 184,
    totalEnrollments: 1250,
    whatYouWillLearn: [
      "Comprendre les principes de hiérarchie visuelle",
      "Choisir une typographie cohérente",
      "Construire une palette de couleurs accessible",
      "Concevoir une page d'atterrissage",
    ],
    requirements: ["Aucun pré-requis"],
    targetAudience: ["Développeurs", "Créateurs de produits"],
    sections: [
      {
        title: "Les bases du design",
        lessons: [
          { title: "Pourquoi le design compte", durationSeconds: 240, isFreePreview: true },
          { title: "Grille et alignement", durationSeconds: 480 },
          { title: "Typographie", durationSeconds: 540 },
        ],
      },
      {
        title: "Couleur et hiérarchie",
        lessons: [
          { title: "Théorie des couleurs", durationSeconds: 480 },
          { title: "Construire une palette accessible", durationSeconds: 600 },
          { title: "Hiérarchie visuelle", durationSeconds: 480 },
        ],
      },
    ],
  },
  {
    slug: "marketing-digital-essentiel",
    title: "Marketing digital : l'essentiel",
    subtitle: "Comprendre SEO, publicité, content marketing et analyse de données en 4 heures.",
    description:
      "Un cours condensé pour entrepreneurs et indépendants qui souhaitent piloter leur présence en ligne sans agence : SEO, Google Ads, contenu, analytics.",
    categorySlug: "marketing",
    level: "ALL_LEVELS",
    priceEUR: 39.9,
    priceUSD: 43.9,
    durationSeconds: 4 * 3600,
    averageRating: 4.4,
    totalRatings: 96,
    totalEnrollments: 730,
    whatYouWillLearn: [
      "Bâtir une stratégie SEO simple et efficace",
      "Lancer une campagne Google Ads",
      "Mesurer ses performances avec Google Analytics 4",
      "Définir un calendrier éditorial",
    ],
    requirements: ["Avoir un projet ou une activité en ligne"],
    targetAudience: ["Entrepreneurs", "Indépendants", "Responsables marketing débutants"],
    sections: [
      {
        title: "SEO",
        lessons: [
          { title: "Comprendre le SEO", durationSeconds: 360, isFreePreview: true },
          { title: "Mots-clés et intention de recherche", durationSeconds: 540 },
          { title: "SEO on-page", durationSeconds: 660 },
        ],
      },
      {
        title: "Publicité et analytics",
        lessons: [
          { title: "Google Ads en pratique", durationSeconds: 720 },
          { title: "Bases de Google Analytics 4", durationSeconds: 540 },
        ],
      },
    ],
  },
  {
    slug: "anglais-professionnel-b2",
    title: "Anglais professionnel niveau B2",
    subtitle: "Gagnez en aisance à l'écrit et à l'oral pour vos échanges professionnels.",
    description:
      "Méthode mêlant grammaire ciblée, mises en situation et conversations guidées. Idéal pour les cadres qui doivent prendre la parole en anglais en réunion ou rédiger des emails clairs.",
    categorySlug: "langues",
    level: "INTERMEDIATE",
    priceEUR: 0,
    priceUSD: 0,
    durationSeconds: 6 * 3600,
    averageRating: 4.6,
    totalRatings: 211,
    totalEnrollments: 4120,
    whatYouWillLearn: [
      "Rédiger des emails professionnels efficaces",
      "Animer une réunion en anglais",
      "Présenter un projet à l'oral",
    ],
    requirements: ["Niveau B1 minimum"],
    targetAudience: ["Cadres", "Indépendants", "Étudiants en école de commerce"],
    sections: [
      {
        title: "Email writing",
        lessons: [
          { title: "Structure d'un email pro", durationSeconds: 420, isFreePreview: true },
          { title: "Politesse et registre", durationSeconds: 480 },
        ],
      },
      {
        title: "Speaking",
        lessons: [
          { title: "Animer un meeting", durationSeconds: 540 },
          { title: "Présenter un projet", durationSeconds: 600 },
        ],
      },
    ],
  },
  // ===========================================================================
  // Cours démo « Open Movies Blender » — vidéos publiques CC BY 3.0 / 2.5
  // hébergées sur Google Cloud Storage. Permet de tester le player sans Mux.
  // À retirer en production réelle (placeholder de démonstration).
  // ===========================================================================
  {
    slug: "blender-open-movies-decouverte",
    title: "Découverte des Open Movies Blender",
    subtitle:
      "Cinq courts-métrages CC BY produits par la Blender Foundation pour explorer le pipeline d'animation 3D libre.",
    description:
      "Ce cours de démonstration utilise les Open Movies de la Blender Foundation (Big Buck Bunny, Sintel, Tears of Steel, Elephant's Dream) pour vous faire découvrir les possibilités de l'animation 3D avec des outils libres. Idéal pour tester le lecteur vidéo et avoir une première intuition du pipeline d'un studio open source.",
    categorySlug: "design",
    level: "BEGINNER",
    priceEUR: 0,
    priceUSD: 0,
    durationSeconds: 596 + 888 + 734 + 15 + 653,
    averageRating: 4.8,
    totalRatings: 42,
    totalEnrollments: 380,
    whatYouWillLearn: [
      "Apprécier les capacités narratives d'un studio 3D open source.",
      "Reconnaître les styles visuels d'Elephant's Dream à Tears of Steel.",
      "Identifier les briques d'un pipeline d'animation moderne.",
      "Naviguer dans la communauté Blender et ses ressources.",
    ],
    requirements: [
      "Une connexion internet capable de lire de la vidéo HD.",
      "Aucune connaissance préalable nécessaire.",
    ],
    targetAudience: [
      "Curieux de l'animation 3D souhaitant comprendre le pipeline.",
      "Étudiants en design ou multimédia.",
    ],
    licenseAttribution:
      "Vidéos © Blender Foundation, sous licence Creative Commons (BY 3.0 / BY 2.5). Voir /credits.",
    sections: [
      {
        title: "Films courts (Open Movies)",
        lessons: [
          {
            title: "Big Buck Bunny — le standard de l'industrie",
            durationSeconds: 596,
            isFreePreview: true,
            externalVideoUrl:
              "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
          },
          {
            title: "Sintel — narration et émotion",
            durationSeconds: 888,
            externalVideoUrl:
              "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
          },
          {
            title: "Tears of Steel — VFX et compositing",
            durationSeconds: 734,
            externalVideoUrl:
              "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
          },
          {
            title: "Elephant's Dream — le tout premier",
            durationSeconds: 653,
            externalVideoUrl:
              "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
          },
        ],
      },
      {
        title: "Bonus court",
        lessons: [
          {
            title: "For Bigger Blazes (extrait court)",
            durationSeconds: 15,
            externalVideoUrl:
              "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            isFreePreview: true,
          },
        ],
      },
    ],
  },
];

async function ensureCourses(instructorId: string) {
  for (const seed of COURSES) {
    const category = await prisma.category.findUnique({
      where: { slug: seed.categorySlug },
    });
    if (!category) continue;

    // 1) upsert du cours sans les sections
    const course = await prisma.course.upsert({
      where: { slug: seed.slug },
      update: {
        title: seed.title,
        subtitle: seed.subtitle,
        description: seed.description,
        level: seed.level,
        priceEUR: seed.priceEUR,
        priceUSD: seed.priceUSD,
        durationSeconds: seed.durationSeconds,
        averageRating: seed.averageRating,
        totalRatings: seed.totalRatings,
        totalEnrollments: seed.totalEnrollments,
        whatYouWillLearn: seed.whatYouWillLearn,
        requirements: seed.requirements,
        targetAudience: seed.targetAudience,
        status: "PUBLISHED",
        publishedAt: new Date(),
        instructorId,
        categoryId: category.id,
      },
      create: {
        slug: seed.slug,
        title: seed.title,
        subtitle: seed.subtitle,
        description: seed.description,
        level: seed.level,
        priceEUR: seed.priceEUR,
        priceUSD: seed.priceUSD,
        durationSeconds: seed.durationSeconds,
        averageRating: seed.averageRating,
        totalRatings: seed.totalRatings,
        totalEnrollments: seed.totalEnrollments,
        whatYouWillLearn: seed.whatYouWillLearn,
        requirements: seed.requirements,
        targetAudience: seed.targetAudience,
        status: "PUBLISHED",
        publishedAt: new Date(),
        instructorId,
        categoryId: category.id,
      },
    });

    // 2) On purge et reconstruit les sections / leçons (idempotent)
    await prisma.section.deleteMany({ where: { courseId: course.id } });

    for (let sectionIndex = 0; sectionIndex < seed.sections.length; sectionIndex++) {
      const sectionSeed = seed.sections[sectionIndex];
      await prisma.section.create({
        data: {
          courseId: course.id,
          title: sectionSeed.title,
          displayOrder: sectionIndex,
          lessons: {
            create: sectionSeed.lessons.map((lesson, lessonIndex) => ({
              title: lesson.title,
              type: lesson.type ?? "VIDEO",
              displayOrder: lessonIndex,
              videoDurationSeconds: lesson.durationSeconds,
              isFreePreview: Boolean(lesson.isFreePreview),
              externalVideoUrl: lesson.externalVideoUrl ?? null,
            })),
          },
        },
      });
    }
  }
}

async function main() {
  console.log("→ Commission rates");
  await ensureCommissionRates();
  console.log("→ Categories");
  await ensureCategories();
  console.log("→ Demo instructor");
  const instructor = await ensureDemoInstructor();
  console.log("→ Courses");
  await ensureCourses(instructor.id);
  console.log("✓ Seed terminé.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
