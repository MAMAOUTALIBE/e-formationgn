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
  // Mentions imposées par l'article 6-III-1 de la LCEN, complétées par celles
  // propres aux organismes de formation (art. L.6352-12 du Code du travail).
  // Les valeurs entre crochets restent à renseigner par le centre : elles sont
  // administratives et volontairement laissées visibles plutôt que devinées.
  "mentions-legales": {
    title: "Mentions légales",
    body: `Éditeur du site
AIDUCA — [forme juridique à compléter : SAS, SARL, SASU…] au capital de [montant à compléter] euros.
Siège social : 91 avenue Aristide Briand, 92120 Montrouge.
SIREN 523 611 523 — RCS [ville du greffe à compléter] 523 611 523.
Numéro de TVA intracommunautaire : [à compléter].
Directeur de la publication : [nom et prénom à compléter].
Contact : info@aiduca.fr — 01 58 42 38 30 — 06 77 89 41 89.

Activité de formation professionnelle
Déclaration d'activité enregistrée sous le numéro 11922091192 auprès du préfet de la région Île-de-France.
Cet enregistrement ne vaut pas agrément de l'État.
Certification Qualiopi n° FP 2020/0005-6, délivrée par [organisme certificateur à compléter] au titre de la catégorie d'action « Actions de formation », valide jusqu'au 20 octobre 2027.

Hébergement du site
Hostinger International Ltd — 61 Lordou Vironos Street, 6023 Larnaca, Chypre — https://www.hostinger.fr
[Téléphone de l'hébergeur à compléter si vous souhaitez le mentionner.]

Propriété intellectuelle
L'ensemble des contenus pédagogiques mis à disposition sur la plateforme (textes, vidéos, documents, quiz) est protégé par le droit d'auteur. L'accès est nominatif et personnel : toute reproduction, diffusion ou mise à disposition de tiers est interdite sans autorisation écrite d'AIDUCA.

Réclamations
Toute réclamation relative à une action de formation peut être adressée à info@aiduca.fr. Une réponse est apportée dans un délai maximal de quinze jours ouvrés.

Données personnelles
Les traitements de données sont décrits dans notre politique de confidentialité.`,
  },
  // Information des personnes au sens de l'article 13 du RGPD.
  //
  // La version précédente omettait plusieurs mentions obligatoires : le droit
  // d'introduire une réclamation auprès de la CNIL, le droit à la limitation,
  // la liste des sous-traitants, les transferts hors Union européenne et des
  // durées de conservation chiffrées. Le tableau finalité → base légale → durée
  // reprend la structure du modèle publié par la CNIL.
  confidentialite: {
    title: "Politique de confidentialité",
    body: `Responsable de traitement
AIDUCA — 91 avenue Aristide Briand, 92120 Montrouge — info@aiduca.fr.
Aucun délégué à la protection des données n'a été désigné : les demandes relatives à vos données sont traitées directement par le centre, à l'adresse ci-dessus.

Qui est concerné
Les personnes qui suivent une formation Aiduca, le plus souvent des salariés inscrits par leur employeur, ainsi que les formateurs et le personnel du centre.

Données collectées
- état civil et coordonnées : nom et prénom, date et lieu de naissance, sexe (facultatif), adresse postale, téléphone, adresse e-mail
- rattachement à une entreprise cliente et à une session de formation
- données pédagogiques : inscriptions, progression, leçons consultées, temps de visionnage, réponses et scores aux quiz, attestations délivrées
- contributions : questions posées, notes personnelles, avis déposés
- données techniques : journaux de connexion, adresse IP sous forme d'empreinte, pages consultées
- cookies et stockages strictement nécessaires à la session, à la sécurité et aux préférences d'affichage

Finalités, bases légales et durées de conservation
- Créer et gérer les comptes, attribuer les formations — exécution de la convention ou du contrat de formation — conservées pendant la relation, puis 3 ans à compter du dernier contact.
- Assurer le suivi pédagogique et délivrer les attestations — exécution de la convention et obligation légale (art. L.6353-1 du Code du travail) — attestations et pièces justificatives conservées pendant la durée requise par les obligations de contrôle applicables à l'organisme, puis archivées.
- Transmettre à l'entreprise cliente les éléments de suivi de ses salariés (assiduité, réalisation, résultats de l'évaluation des acquis) — exécution du contrat conclu avec l'employeur — transmission limitée à ce qui est nécessaire pour justifier de l'action de formation.
- Assurer la sécurité du service et prévenir les accès frauduleux — intérêt légitime — journaux de connexion conservés 90 jours.
- Mesurer l'audience du site de façon anonyme — intérêt légitime, dans les conditions de l'exemption de consentement — 180 jours.
- Envoyer la lettre d'information — consentement — jusqu'au retrait de celui-ci.
- Répondre aux demandes de contact et aux réclamations — intérêt légitime — 3 ans.

Destinataires et sous-traitants
Vos données sont accessibles au personnel habilité du centre, ainsi qu'à l'entreprise qui vous a inscrit pour ce qui concerne le suivi de la formation. Elles sont hébergées et traitées avec le concours des prestataires suivants :
- Hostinger International (Chypre, Union européenne) — hébergement de l'application et de la base de données
- Mux (États-Unis) — hébergement et diffusion des vidéos de formation
- Cloudflare R2 (États-Unis) — stockage des documents et supports de cours
- Resend (États-Unis) — acheminement des courriels transactionnels, lorsqu'il est activé
- Anthropic (États-Unis) — assistants de rédaction et d'accompagnement pédagogique, lorsqu'ils sont activés : les questions posées à l'assistant et les avis soumis à modération lui sont transmis
Aucun de ces prestataires n'est autorisé à utiliser vos données pour son propre compte.

Transferts hors Union européenne
Les prestataires établis aux États-Unis mentionnés ci-dessus impliquent un transfert hors de l'Union européenne. Ces transferts sont encadrés par les clauses contractuelles types de la Commission européenne ou par l'adhésion du prestataire au cadre de protection des données UE–États-Unis.

Décisions automatisées
Aucune décision produisant des effets juridiques à votre égard n'est prise de manière exclusivement automatisée. La correction des quiz est automatique, mais la validation d'une formation relève du centre.

Vos droits
Vous disposez des droits d'accès, de rectification, d'effacement, de limitation du traitement, d'opposition et de portabilité de vos données. Lorsqu'un traitement repose sur votre consentement, vous pouvez le retirer à tout moment, sans que cela remette en cause ce qui a été fait auparavant.
Adressez votre demande à info@aiduca.fr. Une réponse vous est apportée dans un délai d'un mois.
Certaines pièces ne peuvent pas être effacées : les attestations de fin de formation et les inscriptions correspondantes constituent la preuve d'une action de formation et sont conservées à ce titre, conformément à l'article 17.3.b du RGPD.

Réclamation
Si vous estimez, après nous avoir contactés, que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la Commission nationale de l'informatique et des libertés (CNIL) : 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07 — www.cnil.fr.

Sécurité
Les mots de passe ne sont jamais conservés en clair. Les accès sont journalisés, les échanges chiffrés, et les supports de cours ne sont délivrés qu'aux personnes inscrites à la formation concernée.

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
