// Contenu du centre d'aide — source unique.
//
// Ces questions/réponses étaient codées en dur dans src/app/aide/page.tsx.
// Aiduca-IA doit pouvoir s'appuyer dessus (scripts/seed-assistant-knowledge.ts
// les importe dans la base documentaire), et une FAQ dupliquée est une FAQ qui
// diverge : la page et l'assistant lisent désormais le même tableau.
//
// Volontairement sans icône ni JSX : ce module est importé côté serveur par le
// script d'amorçage comme par la page.

export interface HelpFaqItem {
  q: string;
  a: string;
}

export interface HelpFaqSection {
  id: string;
  title: string;
  description: string;
  items: HelpFaqItem[];
}

export const HELP_FAQ_SECTIONS: HelpFaqSection[] = [
  {
    id: "compte",
    title: "Compte et inscription",
    description: "Accéder, gérer et sécuriser votre compte Aiduca.",
    items: [
      {
        q: "Comment créer un compte ?",
        a: "Les comptes sont créés par le centre de formation. Si votre inscription a été validée mais que vous n'avez pas reçu vos informations d'accès, contactez votre gestionnaire ou le support Aiduca.",
      },
      {
        q: "Je n'ai pas reçu mes informations d'accès.",
        a: "Vérifiez vos courriers indésirables, puis contactez votre gestionnaire ou le support. L'équipe pourra contrôler votre inscription et vous indiquer la marche à suivre sans vous demander votre mot de passe.",
      },
      {
        q: "Comment changer mon mot de passe ?",
        a: "Depuis « Mon profil » → section Sécurité → bouton « Réinitialiser le mot de passe ». Vous recevrez un lien sécurisé valable 1 heure.",
      },
      {
        q: "Comment supprimer définitivement mon compte ?",
        a: "Contactez le support via la page Contact. Votre demande sera traitée conformément à notre politique de confidentialité.",
      },
    ],
  },
  {
    id: "apprentissage",
    title: "Apprentissage et progression",
    description: "Accès aux formations, certificats, lecture vidéo.",
    items: [
      {
        q: "Comment accéder à une formation ?",
        a: "Votre société ou le gestionnaire de formation vous inscrit à un programme. Les formations attribuées apparaissent ensuite dans « Mon apprentissage ».",
      },
      {
        q: "Puis-je suivre une formation sur mobile ?",
        a: "Oui. Le site est responsive et fonctionne sur smartphone, tablette et ordinateur. La lecture reprend automatiquement où vous l'avez laissée d'un appareil à l'autre.",
      },
      {
        q: "Comment obtenir mon attestation ?",
        a: "Après avoir terminé 100 % des leçons d'une formation, vous pouvez générer votre attestation de fin de formation depuis votre espace d'apprentissage, puis la télécharger en PDF. Chaque attestation définitive possède un numéro de série vérifiable en ligne.",
      },
      {
        q: "Comment fonctionne le tuteur IA ?",
        a: "Chaque leçon dispose d'un onglet « Tuteur IA » où vous pouvez poser une question contextuelle (limite : 10 questions/heure). L'IA s'appuie sur le contenu de la leçon pour vous répondre.",
      },
      {
        q: "Puis-je télécharger les vidéos pour les regarder hors-ligne ?",
        a: "Le téléchargement vidéo n'est pas autorisé pour respecter les droits des formateurs. En revanche, certaines formations proposent des PDF ou des ressources téléchargeables (visibles dans l'onglet « Ressources » de chaque leçon).",
      },
    ],
  },
  {
    id: "formateurs",
    title: "Devenir formateur",
    description: "Création de formations et accompagnement pédagogique.",
    items: [
      {
        q: "Qui peut publier une formation sur Aiduca ?",
        a: "Les comptes formateurs sont créés et habilités par le gestionnaire de la plateforme. Les formations suivent ensuite le processus de validation pédagogique.",
      },
      {
        q: "Comment suivre les apprenants ?",
        a: "L'espace formateur permet de consulter l'activité pédagogique, les questions et les avis liés à vos formations.",
      },
    ],
  },
  {
    id: "securite",
    title: "Sécurité et données",
    description: "Confidentialité, données personnelles, signalements.",
    items: [
      {
        q: "Mes données sont-elles sécurisées ?",
        a: "Oui. Les mots de passe sont hashés, les sessions signées et les accès protégés par rôle. La plateforme ne collecte aucune donnée bancaire.",
      },
      {
        q: "Comment signaler une formation problématique ou un comportement abusif ?",
        a: "Chaque formation, avis ou question dispose d'un bouton « Signaler ». L'équipe modération examine chaque signalement sous 48h ouvrées.",
      },
      {
        q: "Comment exercer mes droits RGPD ?",
        a: "Pour demander un export de vos données ou leur suppression, contactez-nous via la page Contact en précisant « Demande RGPD ». Nous répondons sous 30 jours.",
      },
    ],
  },
];
