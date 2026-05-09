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
  // ===========================================================================
  // Cours démo « Productivité & Management » — vidéos Pexels (business)
  // ===========================================================================
  {
    slug: "demo-productivite-management",
    title: "Productivité & management d'équipe — démo",
    subtitle:
      "Cinq saynètes de la vie de bureau pour explorer le player et illustrer les modules de management.",
    description:
      "Cours de démonstration construit avec des extraits vidéo Pexels couvrant la réunion d'équipe, le travail à distance, la prise de parole, la visioconférence et la lecture de tableaux de bord. Idéal pour tester le lecteur en environnement de démo et donner aux formateurs un avant-goût des supports possibles.",
    categorySlug: "business",
    level: "BEGINNER",
    priceEUR: 0,
    priceUSD: 0,
    durationSeconds: 35 + 10 + 20 + 10 + 11,
    averageRating: 4.4,
    totalRatings: 18,
    totalEnrollments: 120,
    whatYouWillLearn: [
      "Reconnaître les codes d'une réunion d'équipe productive.",
      "Identifier les bonnes pratiques de visioconférence.",
      "Lire un tableau de bord financier de base.",
      "Structurer une présentation orale courte.",
    ],
    requirements: ["Aucun pré-requis."],
    targetAudience: ["Curieux du management.", "Étudiants en école de commerce."],
    licenseAttribution:
      "Vidéos fournies par Pexels (cottonbro studio, Pavel Danilyuk, Vanessa Garcia, RDNE Stock project) sous Pexels License. Voir /credits.",
    sections: [
      {
        title: "Travailler en équipe",
        lessons: [
          {
            title: "La réunion d'équipe (cottonbro studio)",
            durationSeconds: 35,
            isFreePreview: true,
            externalVideoUrl:
              "https://videos.pexels.com/video-files/5971784/5971784-hd_720_1366_25fps.mp4",
          },
          {
            title: "La visioconférence avec un collègue (Vanessa Garcia)",
            durationSeconds: 10,
            externalVideoUrl:
              "https://videos.pexels.com/video-files/6325284/6325284-hd_720_1280_24fps.mp4",
          },
        ],
      },
      {
        title: "Travailler en autonomie",
        lessons: [
          {
            title: "Travailler sur ordinateur portable (Pavel Danilyuk)",
            durationSeconds: 10,
            externalVideoUrl:
              "https://videos.pexels.com/video-files/5303248/5303248-hd_1280_720_30fps.mp4",
          },
          {
            title: "Présenter un projet à l'oral (Pavel Danilyuk)",
            durationSeconds: 20,
            externalVideoUrl:
              "https://videos.pexels.com/video-files/7812402/7812402-hd_1080_1920_25fps.mp4",
          },
        ],
      },
      {
        title: "Mesurer la performance",
        lessons: [
          {
            title: "Lire un tableau de bord (RDNE Stock project)",
            durationSeconds: 11,
            externalVideoUrl:
              "https://videos.pexels.com/video-files/7947420/7947420-hd_1280_720_30fps.mp4",
          },
        ],
      },
    ],
  },
  // ===========================================================================
  // Cours démo « Tech & Code » — vidéos Pexels (tech)
  // ===========================================================================
  {
    slug: "demo-tech-code",
    title: "Tech & code — démo",
    subtitle:
      "Quatre clips d'ambiance pour illustrer la programmation, la cybersécurité et l'intelligence artificielle.",
    description:
      "Cours de démonstration construit avec des extraits Pexels du monde tech : code en cours d'écriture, développeur au travail, esthétique cybersécurité et abstractions IA. Utile pour tester le lecteur et donner une intuition visuelle aux formateurs qui rédigeront leurs propres modules.",
    categorySlug: "developpement",
    level: "ALL_LEVELS",
    priceEUR: 0,
    priceUSD: 0,
    durationSeconds: 17 + 15 + 10 + 10,
    averageRating: 4.5,
    totalRatings: 22,
    totalEnrollments: 180,
    whatYouWillLearn: [
      "Reconnaître l'environnement quotidien du développeur.",
      "Identifier les codes visuels de la cybersécurité.",
      "Saisir l'esthétique associée aux modèles d'IA.",
      "Évaluer la qualité d'une vidéo d'illustration tech.",
    ],
    requirements: ["Aucun pré-requis."],
    targetAudience: ["Curieux du métier de développeur.", "Étudiants en informatique."],
    licenseAttribution:
      "Vidéos Pexels par cottonbro studio, Jakub Zerdzicki et Nicola Narracci sous Pexels License. Voir /credits.",
    sections: [
      {
        title: "Quotidien du développeur",
        lessons: [
          {
            title: "Code en cours d'écriture (cottonbro studio)",
            durationSeconds: 17,
            isFreePreview: true,
            externalVideoUrl:
              "https://videos.pexels.com/video-files/6804121/6804121-hd_2048_1080_25fps.mp4",
          },
          {
            title: "Développeur au travail (Jakub Zerdzicki)",
            durationSeconds: 15,
            externalVideoUrl:
              "https://videos.pexels.com/video-files/36328473/15406850_1920_1080_25fps.mp4",
          },
        ],
      },
      {
        title: "Sécurité & IA",
        lessons: [
          {
            title: "Cybersécurité — ambiance Matrix (Nicola Narracci)",
            durationSeconds: 10,
            externalVideoUrl:
              "https://videos.pexels.com/video-files/33503696/14250431_1920_1080_30fps.mp4",
          },
          {
            title: "Réseau de neurones — abstraction (Nicola Narracci)",
            durationSeconds: 10,
            externalVideoUrl:
              "https://videos.pexels.com/video-files/34994032/14825727_1920_1080_30fps.mp4",
          },
        ],
      },
    ],
  },
  // ===========================================================================
  // Cours démo « Design en pratique » — vidéos Pexels (design)
  // ===========================================================================
  {
    slug: "demo-design-pratique",
    title: "Design en pratique — démo",
    subtitle:
      "Trois extraits pour explorer l'illustration digitale, la photo studio et la conception d'interfaces.",
    description:
      "Cours de démonstration regroupant trois facettes du métier de designer : tablette graphique, photographie professionnelle et conception UI/UX. Pratique pour tester le lecteur et donner une vibe à la catégorie Design.",
    categorySlug: "design",
    level: "BEGINNER",
    priceEUR: 0,
    priceUSD: 0,
    durationSeconds: 10 + 5 + 10,
    averageRating: 4.6,
    totalRatings: 12,
    totalEnrollments: 95,
    whatYouWillLearn: [
      "Saisir les outils du designer numérique.",
      "Repérer les codes visuels de la photo studio.",
      "Identifier l'environnement de conception UI/UX.",
    ],
    requirements: ["Aucun pré-requis."],
    targetAudience: ["Étudiants en design.", "Reconvertis en quête d'orientation."],
    licenseAttribution:
      "Vidéos Pexels par Luna Lovegood, Amar Preciado et Jakub Zerdzicki sous Pexels License. Voir /credits.",
    sections: [
      {
        title: "Trois métiers du design",
        lessons: [
          {
            title: "Illustration sur tablette graphique (Luna Lovegood)",
            durationSeconds: 10,
            isFreePreview: true,
            externalVideoUrl:
              "https://videos.pexels.com/video-files/4465903/4465903-hd_1280_720_50fps.mp4",
          },
          {
            title: "Photographie en studio (Amar Preciado)",
            durationSeconds: 5,
            externalVideoUrl:
              "https://videos.pexels.com/video-files/28599142/12429723_1080_1920_30fps.mp4",
          },
          {
            title: "Conception UI/UX (Jakub Zerdzicki)",
            durationSeconds: 10,
            externalVideoUrl:
              "https://videos.pexels.com/video-files/33222598/14157413_3840_2160_25fps.mp4",
          },
        ],
      },
    ],
  },
  // ===========================================================================
  // Cours démo « Marketing digital » — vidéos Pexels (marketing + general)
  // ===========================================================================
  {
    slug: "demo-marketing-digital",
    title: "Marketing digital — démo",
    subtitle:
      "Trois extraits pour explorer les réseaux sociaux, l'idéation marketing et l'apprentissage continu.",
    description:
      "Cours de démonstration centré sur le marketing digital : usage du smartphone et des réseaux sociaux, brainstorming d'équipe et apprentissage continu. Sert de toile pour tester le lecteur et illustrer la catégorie Marketing.",
    categorySlug: "marketing",
    level: "BEGINNER",
    priceEUR: 0,
    priceUSD: 0,
    durationSeconds: 17 + 16 + 18,
    averageRating: 4.3,
    totalRatings: 9,
    totalEnrollments: 60,
    whatYouWillLearn: [
      "Comprendre les codes des réseaux sociaux mobiles.",
      "Identifier les rituels d'une session de brainstorming.",
      "Saisir l'importance de l'apprentissage continu.",
    ],
    requirements: ["Aucun pré-requis."],
    targetAudience: ["Curieux du marketing digital.", "Community managers en formation."],
    licenseAttribution:
      "Vidéos Pexels par Joshua Malic, Mikael Blomkvist et olia danilevich sous Pexels License. Voir /credits.",
    sections: [
      {
        title: "Marketing digital",
        lessons: [
          {
            title: "Réseaux sociaux sur mobile (Joshua Malic)",
            durationSeconds: 17,
            isFreePreview: true,
            externalVideoUrl:
              "https://videos.pexels.com/video-files/6756650/6756650-hd_1920_1080_24fps.mp4",
          },
          {
            title: "Brainstorming d'équipe (Mikael Blomkvist)",
            durationSeconds: 16,
            externalVideoUrl:
              "https://videos.pexels.com/video-files/6557707/6557707-hd_720_1280_25fps.mp4",
          },
        ],
      },
      {
        title: "Bonus — apprendre en continu",
        lessons: [
          {
            title: "Étudiante en train d'apprendre (olia danilevich)",
            durationSeconds: 18,
            externalVideoUrl:
              "https://videos.pexels.com/video-files/4487962/4487962-hd_1280_720_25fps.mp4",
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
