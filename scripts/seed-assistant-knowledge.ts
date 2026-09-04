// Amorçage de la base documentaire d'Aiduca-IA depuis les sources existantes.
//
//   npx tsx scripts/seed-assistant-knowledge.ts
//
// Idempotent : relançable sans risque. Chaque document est identifié par son
// slug ; une exécution ultérieure met à jour le texte et réindexe.
//
// IMPORTANT — le script n'écrase QUE les documents qu'il a lui-même créés,
// reconnaissables à leur préfixe de slug. Un document rédigé à la main dans
// /admin/assistant/sources n'est jamais touché : sans cette règle, la première
// relance du script effacerait le travail éditorial de l'équipe.

import "dotenv/config";

import { pathToFileURL } from "node:url";

import { BRAND } from "../src/lib/brand";
import { chunkDocument } from "../src/lib/assistant/chunking";
import { getCmsPage } from "../src/lib/cms";
import { HELP_FAQ_SECTIONS } from "../src/lib/help-faq";
import { prisma } from "../src/lib/prisma";

/** Préfixe réservé aux documents générés — voir l'avertissement ci-dessus. */
const GENERATED_PREFIX = "auto-";

interface SeedDocument {
  slug: string;
  title: string;
  category: string;
  body: string;
  sourceLabel: string | null;
  sourceUrl: string | null;
  position: number;
}

/** Pages CMS reprises telles quelles, avec leur route publique. */
const CMS_SOURCES: Array<{
  slug: string;
  category: string;
  url: string;
  label: string;
}> = [
  { slug: "contact", category: "Essentiels", url: "/contact", label: "Page Contact" },
  { slug: "a-propos", category: "Essentiels", url: "/a-propos", label: "Page À propos" },
  { slug: "cgv", category: "Conditions", url: "/cgv", label: "CGV" },
  {
    slug: "mentions-legales",
    category: "Conditions",
    url: "/mentions-legales",
    label: "Mentions légales",
  },
  {
    slug: "confidentialite",
    category: "Conditions",
    url: "/confidentialite",
    label: "Politique de confidentialité",
  },
  { slug: "cookies", category: "Conditions", url: "/cookies", label: "Politique cookies" },
];

/**
 * Faits qui ne sont écrits nulle part sous forme de texte exploitable.
 *
 * Le fonctionnement du centre — pas de vente en ligne, inscription ouverte par
 * l'équipe — est aujourd'hui une propriété du code (`platform-mode.ts`,
 * `course-access-notice.tsx`), pas une phrase. L'assistant ne peut pas lire du
 * code : il faut le lui dire.
 */
function buildOperatingDocuments(): SeedDocument[] {
  return [
    {
      slug: `${GENERATED_PREFIX}inscription`,
      title: "Comment s'inscrire à une formation Aiduca",
      category: "Essentiels",
      position: 0,
      sourceLabel: "Fonctionnement du centre",
      sourceUrl: "/contact",
      body: `Prix, tarifs et modalités d'inscription :
Aiduca est un centre de formation. Il n'y a pas de vente en ligne, pas de panier et pas d'achat immédiat sur le site : on ne s'inscrit pas soi-même à une formation, et aucun prix n'est affiché sur les fiches. Combien coûte une formation dépend du parcours, de sa durée et du financement mobilisé ; le centre établit un devis après un échange sur votre projet.

Qui ouvre l'accès :
L'inscription est enregistrée par l'équipe Aiduca, ou par le gestionnaire de formation de votre entreprise lorsque celle-ci finance votre parcours. Une fois l'inscription activée, l'accès aux contenus de la formation est ouvert sur la plateforme et vous recevez vos informations de connexion.

Comment demander une inscription :
Contactez le centre par e-mail à ${BRAND.email}, par téléphone au ${BRAND.phone} ou au ${BRAND.mobile}. Vous pouvez aussi utiliser la page Contact du site. Indiquez la formation qui vous intéresse et votre situation (salarié, demandeur d'emploi, financement par votre employeur).

Tarifs :
Les tarifs ne sont pas affichés sur le site. Ils dépendent du parcours, de sa durée et du dispositif de financement. Le centre établit un devis après un échange sur votre projet.`,
    },
    {
      slug: `${GENERATED_PREFIX}financement`,
      title: "Financement des formations",
      category: "Essentiels",
      position: 1,
      sourceLabel: "Fonctionnement du centre",
      sourceUrl: "/contact",
      body: `Prise en charge :
Aiduca est un organisme de formation déclaré sous le numéro ${BRAND.activityDeclaration}. À ce titre, les formations peuvent faire l'objet d'une prise en charge par un opérateur de compétences (OPCO), par l'employeur, ou par un autre financeur selon votre situation.

Certification Qualiopi :
Aiduca est certifié Qualiopi au titre des actions de formation, certificat ${BRAND.qualiopiCertificate}, valide jusqu'au ${BRAND.qualiopiValidUntil}. Cette certification est la condition d'accès aux fonds publics et mutualisés de la formation professionnelle.

Comment procéder :
Le montage du dossier de financement se fait avec l'équipe Aiduca. Contactez le centre à ${BRAND.email} ou au ${BRAND.phone} pour être accompagné : les démarches et les pièces à fournir dépendent du financeur.`,
    },
    {
      slug: `${GENERATED_PREFIX}coordonnees`,
      title: "Coordonnées et horaires d'Aiduca",
      category: "Essentiels",
      position: 2,
      sourceLabel: "Page Contact",
      sourceUrl: "/contact",
      body: `Coordonnées :
${BRAND.legalName}, ${BRAND.address}.
E-mail : ${BRAND.email}
Téléphone : ${BRAND.phone}
Mobile : ${BRAND.mobile}

Horaires d'ouverture :
Du lundi au vendredi de 8 h à 19 h, et le samedi de 9 h à 17 h.

Identification :
SIREN ${BRAND.siren}. Déclaration d'activité de formation ${BRAND.activityDeclaration}.`,
    },
    {
      slug: `${GENERATED_PREFIX}attestations`,
      title: "Attestations et suivi de formation",
      category: "Essentiels",
      position: 3,
      sourceLabel: "Centre d'aide",
      sourceUrl: "/aide",
      body: `Attestation de fin de formation :
À l'issue d'un parcours suivi jusqu'au bout, une attestation de fin de formation est délivrée. Elle mentionne les objectifs de la formation et le temps réellement réalisé, conformément à l'article L.6353-1 du Code du travail.

Vérification d'une attestation :
Chaque attestation porte un numéro de série. N'importe qui peut en vérifier l'authenticité sur le site, à l'adresse /certificat suivie du numéro de série.

Suivi du temps de connexion :
Le temps passé sur la plateforme est mesuré pendant la formation. Il alimente la feuille d'émargement et le calcul des heures réalisées.`,
    },
  ];
}

/** La FAQ du centre d'aide, une section = un document. */
function buildHelpDocuments(): SeedDocument[] {
  return HELP_FAQ_SECTIONS.map((section, index) => ({
    slug: `${GENERATED_PREFIX}aide-${section.id}`,
    title: `Aide — ${section.title}`,
    category: "Centre d'aide",
    position: index,
    sourceLabel: "Centre d'aide",
    sourceUrl: "/aide",
    body: [
      section.description,
      "",
      ...section.items.map((item) => `${item.q}\n${item.a}`),
    ].join("\n\n"),
  }));
}

async function buildCmsDocuments(): Promise<SeedDocument[]> {
  const documents: SeedDocument[] = [];
  for (const [index, source] of CMS_SOURCES.entries()) {
    // `getCmsPage` et non `prisma.cmsPage` : une page jamais créée en base a
    // quand même un contenu de référence codé en dur, et c'est celui que le
    // site affiche. Lire la table directement raterait ces pages-là.
    const page = await getCmsPage(source.slug);
    documents.push({
      slug: `${GENERATED_PREFIX}${source.slug}`,
      title: page.title,
      category: source.category,
      // Décalées après les documents métier (positions 0 à 3) : le filet
      // « Essentiels » est trié par position, deux documents à 0 rendraient
      // son contenu dépendant de l'ordre d'insertion.
      position: 10 + index,
      sourceLabel: source.label,
      sourceUrl: source.url,
      body: page.body,
    });
  }
  return documents;
}

async function upsertDocument(doc: SeedDocument): Promise<number> {
  const record = await prisma.assistantDocument.upsert({
    where: { slug: doc.slug },
    create: {
      slug: doc.slug,
      title: doc.title,
      category: doc.category,
      body: doc.body,
      sourceLabel: doc.sourceLabel,
      sourceUrl: doc.sourceUrl,
      position: doc.position,
      isPublished: true,
    },
    update: {
      title: doc.title,
      category: doc.category,
      body: doc.body,
      sourceLabel: doc.sourceLabel,
      sourceUrl: doc.sourceUrl,
      position: doc.position,
    },
    select: { id: true },
  });

  const chunks = chunkDocument(doc.body, doc.title);
  await prisma.$transaction([
    prisma.assistantChunk.deleteMany({ where: { documentId: record.id } }),
    prisma.assistantChunk.createMany({
      data: chunks.map((chunk) => ({
        documentId: record.id,
        documentTitle: doc.title,
        position: chunk.position,
        heading: chunk.heading,
        content: chunk.content,
      })),
    }),
  ]);

  return chunks.length;
}

export interface AssistantKnowledgeSeedResult {
  documents: number;
  chunks: number;
  manualDocuments: number;
}

/**
 * Synchronise les documents générés depuis les sources publiques du site.
 *
 * Exportée pour que le même traitement soit disponible depuis l'administration
 * en production, où le fichier TypeScript source n'est pas copié dans l'image.
 */
export async function seedAssistantKnowledge(options: { log?: boolean } = {}): Promise<AssistantKnowledgeSeedResult> {
  const documents = [
    ...buildOperatingDocuments(),
    ...(await buildCmsDocuments()),
    ...buildHelpDocuments(),
  ];

  let totalChunks = 0;
  for (const doc of documents) {
    const chunks = await upsertDocument(doc);
    totalChunks += chunks;
    if (options.log !== false) {
      console.log(`  ${doc.slug} — ${chunks} fragment(s)`);
    }
  }

  const manual = await prisma.assistantDocument.count({
    where: { NOT: { slug: { startsWith: GENERATED_PREFIX } } },
  });

  if (options.log !== false) {
    console.log(
      `\n${documents.length} document(s) générés, ${totalChunks} fragment(s) indexés.`,
    );
    console.log(`${manual} document(s) rédigés à la main, laissés intacts.`);
  }

  return {
    documents: documents.length,
    chunks: totalChunks,
    manualDocuments: manual,
  };
}

const invokedAsScript = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (invokedAsScript) {
  seedAssistantKnowledge()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
