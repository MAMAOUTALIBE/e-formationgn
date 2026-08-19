// Helpers CMS — récupère une page éditoriale par slug, ou utilise un
// contenu par défaut si la page n'a pas encore été créée par un admin.

import { prisma } from "@/lib/prisma";

interface DefaultCmsPage {
  title: string;
  body: string;
}

const FALLBACK_CONTENT: Record<string, DefaultCmsPage> = {
  cgv: {
    title: "Conditions générales de vente",
    body: `Les présentes conditions régissent les achats effectués sur la plateforme Aiduca.

1. Identité du vendeur
AIDUCA. Siège social : 91 avenue Aristide Briand, 92120 Montrouge. SIREN 523 611 523. Déclaration d'activité 11922091192. Contact : info@aiduca.fr.

2. Produits
La plateforme propose l'accès à des formations en ligne créées par des formateurs indépendants. L'accès est nominatif et non transférable.

3. Prix
Les prix sont indiqués TTC en euros (EUR) ou en dollars américains (USD) selon la devise sélectionnée. La TVA est facturée selon la législation applicable au pays de l'acheteur.

4. Paiement
Les paiements sont traités par les prestataires proposés sur la plateforme. Aiduca ne stocke aucune donnée bancaire.

5. Droit de rétractation
Conformément à l'article L221-28 du Code de la consommation, l'accès immédiat au contenu numérique entraîne la perte du droit de rétractation. Une politique de remboursement commerciale de 14 jours s'applique néanmoins, sous réserve de moins de 25 % de la formation consultée.

6. Garanties
Les formations sont fournies « en l'état ». Aiduca s'engage à un effort raisonnable de qualité et de disponibilité.

7. Données personnelles
Voir notre politique de confidentialité.

8. Litiges
Droit français. Tribunaux français compétents en cas de litige.

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
- identification (nom, email)
- comptes OAuth (Google, le cas échéant)
- progression et notes pédagogiques
- données de paiement (uniquement via Stripe ; Aiduca ne stocke aucune carte bancaire)
- cookies fonctionnels (devise, affiliation, session)

Finalités :
- fournir le service (compte, achats, accès aux formations)
- émettre les certificats
- statistiques anonymisées d'utilisation

Bases légales : exécution contractuelle, intérêt légitime, consentement.

Durée de conservation : la durée nécessaire à la fourniture du service, puis conformément aux obligations légales (factures : 10 ans).

Droits RGPD : accès, rectification, effacement, portabilité, opposition. Adressez votre demande à info@aiduca.fr.

Sous-traitants principaux : Supabase (base de données, UE), Stripe (paiements, irlande/UE), Mux (hébergement vidéo, US/UE), Resend (emails, US/UE).

Contact : info@aiduca.fr.`,
  },
  cookies: {
    title: "Politique cookies",
    body: `Aiduca utilise les cookies suivants :

- Strictement nécessaires : session d'authentification, panier, devise, code d'affiliation. Sans ces cookies, le service ne peut pas fonctionner.
- Préférences : choix de devise EUR/USD.
- Pas de cookie publicitaire ni de tracker tiers à des fins marketing dans la version courante de la plateforme.

Vous pouvez supprimer les cookies à tout moment depuis votre navigateur.

(À personnaliser via /admin/cms.)`,
  },
  "a-propos": {
    title: "À propos d'Aiduca",
    body: `Depuis 2010, l'institut AIDUCA accompagne les artisans et les professionnels du bâtiment dans leur montée en compétence. Ses formations qualifiantes privilégient une approche opérationnelle, des formateurs de terrain et des plateaux techniques adaptés.

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
  const fallback = FALLBACK_CONTENT[slug];
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
