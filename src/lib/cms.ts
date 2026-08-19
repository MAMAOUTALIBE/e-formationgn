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
    body: `Les présentes conditions régissent les achats effectués sur Gandal.

1. Identité du vendeur
Gandal, SAS au capital de — €. Siège social : —. SIREN —. Contact : contact@gandal.gn.

2. Produits
La plateforme propose l'accès à des formations en ligne créées par des formateurs indépendants. L'accès est nominatif et non transférable.

3. Prix
Les prix sont indiqués TTC en euros (EUR) ou en dollars américains (USD) selon la devise sélectionnée. La TVA est facturée selon la législation applicable au pays de l'acheteur.

4. Paiement
Les paiements sont traités par Stripe. Gandal ne stocke aucune donnée bancaire.

5. Droit de rétractation
Conformément à l'article L221-28 du Code de la consommation, l'accès immédiat au contenu numérique entraîne la perte du droit de rétractation. Une politique de remboursement commerciale de 14 jours s'applique néanmoins, sous réserve de moins de 25 % de la formation consultée.

6. Garanties
Les formations sont fournies « en l'état ». Gandal s'engage à un effort raisonnable de qualité et de disponibilité.

7. Données personnelles
Voir notre politique de confidentialité.

8. Litiges
Droit français. Tribunaux français compétents en cas de litige.

(À personnaliser via /admin/cms.)`,
  },
  "mentions-legales": {
    title: "Mentions légales",
    body: `Éditeur : Gandal — SAS — RCS — — SIREN —.
Directeur de la publication : —.
Hébergeur : Vercel Inc., 340 S Lemon Ave #4133, Walnut CA 91789, États-Unis.
Base de données : Supabase (Union européenne).

Contact : contact@gandal.gn

(À personnaliser via /admin/cms.)`,
  },
  confidentialite: {
    title: "Politique de confidentialité",
    body: `Responsable de traitement : Gandal.

Données collectées :
- identification (nom, email)
- comptes OAuth (Google, le cas échéant)
- progression et notes pédagogiques
- données de paiement (uniquement via Stripe ; Gandal ne stocke aucune carte bancaire)
- cookies fonctionnels (devise, affiliation, session)

Finalités :
- fournir le service (compte, achats, accès aux formations)
- émettre les certificats
- statistiques anonymisées d'utilisation

Bases légales : exécution contractuelle, intérêt légitime, consentement.

Durée de conservation : la durée nécessaire à la fourniture du service, puis conformément aux obligations légales (factures : 10 ans).

Droits RGPD : accès, rectification, effacement, portabilité, opposition. Adressez votre demande à contact@gandal.gn.

Sous-traitants principaux : Supabase (base de données, UE), Stripe (paiements, irlande/UE), Mux (hébergement vidéo, US/UE), Resend (emails, US/UE).

(À personnaliser via /admin/cms.)`,
  },
  cookies: {
    title: "Politique cookies",
    body: `Gandal utilise les cookies suivants :

- Strictement nécessaires : session d'authentification, panier, devise, code d'affiliation. Sans ces cookies, le service ne peut pas fonctionner.
- Préférences : choix de devise EUR/USD.
- Pas de cookie publicitaire ni de tracker tiers à des fins marketing dans la version courante de la plateforme.

Vous pouvez supprimer les cookies à tout moment depuis votre navigateur.

(À personnaliser via /admin/cms.)`,
  },
  "a-propos": {
    title: "À propos d'Gandal",
    body: `Gandal est la marketplace francophone de formation en ligne. Notre mission : rendre l'éducation accessible à tous, partout, et offrir aux experts un canal pour partager leur savoir tout en étant rémunérés équitablement.

(À personnaliser via /admin/cms.)`,
  },
  contact: {
    title: "Contact",
    body: `Pour toute question, écrivez-nous à contact@gandal.gn.

Pour les questions de modération, support@gandal.gn.

(À personnaliser via /admin/cms.)`,
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
