// Helpers CMS — récupère une page éditoriale par slug, ou utilise un
// contenu par défaut si la page n'a pas encore été créée par un admin.

import { prisma } from "@/lib/prisma";

export interface DefaultCmsPage {
  title: string;
  body: string;
}

export const CMS_REFERENCE_CONTENT: Record<string, DefaultCmsPage> = {
  cgv: {
    title: "Conditions d'accès aux formations",
    body: `Les présentes conditions décrivent l'accès à la plateforme de formation Aiduca dans son fonctionnement actuel.

1. Organisme de formation
AIDUCA. Siège social : 91 avenue Aristide Briand, 92120 Montrouge. SIREN 523 611 523. Déclaration d'activité 11922091192. Contact : info@aiduca.fr.

2. Création des comptes et inscriptions
Les comptes et les accès aux formations sont créés ou attribués par AIDUCA, un gestionnaire habilité ou, le cas échéant, l'entreprise qui inscrit ses stagiaires. L'inscription publique et l'achat en ligne ne sont pas proposés dans la version actuelle de la plateforme.

3. Accès
L'accès est nominatif, personnel et non transférable. Les modalités financières éventuelles relèvent de la convention, du contrat ou de l'accord conclu séparément avec AIDUCA ; aucun paiement n'est encaissé sur cette plateforme.

4. Utilisation du service
L'utilisateur s'engage à préserver la confidentialité de ses identifiants et à utiliser les contenus uniquement dans le cadre de sa formation. Toute difficulté d'accès doit être signalée à AIDUCA.

5. Disponibilité et accompagnement
AIDUCA met en œuvre des moyens raisonnables pour assurer la disponibilité du service et l'accompagnement pédagogique. Des interruptions de maintenance peuvent être nécessaires.

6. Attestations
Une attestation de fin de formation peut être générée lorsque les conditions pédagogiques prévues sont remplies. Elle est nominative et peut comporter une référence permettant d'en vérifier l'authenticité.

7. Données personnelles
Voir notre politique de confidentialité.

8. Litiges
Les règles applicables dépendent de la convention ou du contrat de formation concerné. En cas de difficulté, contactez d'abord AIDUCA afin de rechercher une solution amiable.

La certification Qualiopi n° FP 2020/0005-6 porte sur la catégorie « Actions de formation » et est valide jusqu'au 20 octobre 2027.`,
  },
  "mentions-legales": {
    title: "Mentions légales",
    body: `Éditeur : AIDUCA — SIREN 523 611 523.
Siège social : 91 avenue Aristide Briand, 92120 Montrouge.
N° de déclaration d'activité : 11922091192.
Certification Qualiopi : FP 2020/0005-6, catégorie « Actions de formation », valide jusqu'au 20 octobre 2027.

Contact : info@aiduca.fr — 01 58 42 38 30 — 06 77 89 41 89.`,
  },
  confidentialite: {
    title: "Politique de confidentialité",
    body: `Responsable de traitement : AIDUCA, 91 avenue Aristide Briand, 92120 Montrouge.

Données collectées :
- identification et coordonnées professionnelles nécessaires à la formation
- rattachement éventuel à une société ou à une session de formation
- progression, réponses aux quiz et données pédagogiques
- informations techniques et journaux de sécurité nécessaires au fonctionnement
- cookies strictement nécessaires à la session et à la sécurité

Finalités :
- créer les comptes et attribuer les formations
- fournir le service et suivre la progression pédagogique
- générer les attestations de fin de formation
- assurer la sécurité, le support et produire des statistiques d'utilisation

Les traitements sont réalisés selon la base légale applicable à chaque situation, notamment l'exécution d'une convention ou d'un contrat de formation, le respect d'obligations légales et l'intérêt légitime lié à la sécurité du service.

Les données sont conservées pendant la durée nécessaire à la formation, au suivi administratif et au respect des obligations applicables. Les durées précises peuvent varier selon la nature du document concerné.

Droits RGPD : accès, rectification, effacement, portabilité, opposition. Adressez votre demande à info@aiduca.fr.

Hébergement et stockage : l'application et sa base PostgreSQL sont hébergées sur un serveur exploité auprès d'Hostinger. Certains fichiers peuvent être stockés localement sur cette infrastructure. Un service d'envoi d'e-mails n'est utilisé que lorsqu'il est effectivement configuré. Aucune donnée bancaire n'est collectée par la plateforme dans son fonctionnement actuel.

Contact : info@aiduca.fr.`,
  },
  cookies: {
    title: "Politique cookies",
    body: `Aiduca utilise un nombre limité de cookies et stockages techniques :

- Strictement nécessaires : authentification, maintien de la session, sécurité et mémorisation du choix relatif aux cookies. Sans eux, certaines fonctions protégées ne peuvent pas fonctionner.
- Préférences techniques : certaines préférences d'affichage peuvent être conservées dans le navigateur.
- La version actuelle de la plateforme n'utilise ni panier, ni préférence de devise, ni code d'affiliation et ne dépose pas de cookie publicitaire à des fins marketing.

Vous pouvez supprimer ces données à tout moment depuis les paramètres de votre navigateur. Une nouvelle authentification pourra alors être nécessaire.`,
  },
  "a-propos": {
    title: "À propos d'Aiduca",
    body: `Depuis 2010, l'institut AIDUCA accompagne les professionnels dans le développement de leurs compétences. Ses formations privilégient une approche opérationnelle, un suivi pédagogique structuré et des contenus adaptés aux objectifs de chaque parcours.

AIDUCA est certifié Qualiopi pour les actions de formation (certificat n° FP 2020/0005-6, valide jusqu'au 20 octobre 2027).`,
  },
  contact: {
    title: "Contact",
    body: `Institut AIDUCA
91 avenue Aristide Briand
92120 Montrouge

E-mail : info@aiduca.fr
Téléphone : 01 58 42 38 30
Mobile : 06 77 89 41 89

Horaires : du lundi au vendredi de 8 h à 19 h, le samedi de 9 h à 17 h.`,
  },
};

export async function getCmsPage(slug: string): Promise<{
  title: string;
  body: string;
  isPublished: boolean;
  fromFallback: boolean;
}> {
  const page = await prisma.cmsPage.findUnique({ where: { slug } });
  if (page && page.isPublished) {
    return {
      title: page.title,
      body: page.body,
      isPublished: true,
      fromFallback: false,
    };
  }
  const fallback = CMS_REFERENCE_CONTENT[slug];
  if (!fallback) {
    return {
      title: page?.title ?? "Page",
      body: page?.body ?? "Cette page n'a pas encore été rédigée.",
      isPublished: false,
      fromFallback: false,
    };
  }
  return {
    title: page?.title ?? fallback.title,
    body: page?.body ?? fallback.body,
    isPublished: page?.isPublished ?? false,
    fromFallback: !page,
  };
}
