import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronDown,
  CreditCard,
  GraduationCap,
  LifeBuoy,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";

import {
  HelpSearch,
  type HelpSearchItem,
} from "@/components/features/marketing/help-search";
import { JsonLd } from "@/components/seo/json-ld";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Centre d'aide",
  description:
    "Trouvez rapidement des réponses sur Gandal : compte, achats, apprentissage, formateurs, remboursements.",
  alternates: { canonical: "/aide" },
};

interface FaqItem {
  q: string;
  a: string;
}

interface FaqSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  items: FaqItem[];
}

const SECTIONS: FaqSection[] = [
  {
    id: "compte",
    title: "Compte et inscription",
    icon: User,
    description: "Créer, gérer et sécuriser votre compte Gandal.",
    items: [
      {
        q: "Comment créer un compte ?",
        a: "Rendez-vous sur la page Inscription. Renseignez votre email + mot de passe (ou utilisez « Continuer avec Google »). Un email de vérification est envoyé pour confirmer votre adresse.",
      },
      {
        q: "Je n'ai pas reçu l'email de vérification.",
        a: "Vérifiez vos spams. Si rien après 5 minutes, recliquez sur le bouton « Renvoyer l'email » depuis la page de connexion. Si l'email reste introuvable, contactez le support.",
      },
      {
        q: "Comment changer mon mot de passe ?",
        a: "Depuis « Mon profil » → section Sécurité → bouton « Réinitialiser le mot de passe ». Vous recevrez un lien sécurisé valable 1 heure.",
      },
      {
        q: "Comment supprimer définitivement mon compte ?",
        a: "Contactez le support via la page Contact. Conformément au RGPD, nous supprimons toutes vos données personnelles sous 30 jours (les commandes restent anonymisées pour la comptabilité).",
      },
    ],
  },
  {
    id: "achats",
    title: "Achats et paiements",
    icon: CreditCard,
    description: "Méthodes de paiement, factures, remboursements.",
    items: [
      {
        q: "Quels moyens de paiement acceptez-vous ?",
        a: "Carte bancaire internationale (Visa, Mastercard, Amex) via Stripe pour les paiements en EUR ou USD. Mobile Money (Orange Money, MTN MoMo, Wave) et cartes locales via CinetPay pour les paiements en GNF ou XOF.",
      },
      {
        q: "Comment fonctionne la garantie 30 jours ?",
        a: "Vous avez 30 jours après l'achat pour demander un remboursement intégral, sans avoir à vous justifier. Allez dans « Mes commandes », cliquez sur la commande concernée et choisissez « Demander un remboursement ».",
      },
      {
        q: "Où trouver ma facture ?",
        a: "Chaque commande payée génère automatiquement une facture téléchargeable au format PDF, disponible depuis « Mes commandes ».",
      },
      {
        q: "Le code promo ne fonctionne pas — que faire ?",
        a: "Vérifiez l'orthographe (le code est sensible à la casse), sa date d'expiration, et qu'il s'applique bien aux cours présents dans votre panier. Certains codes sont limités à un nombre d'utilisations.",
      },
      {
        q: "Puis-je offrir un cours à quelqu'un ?",
        a: "La fonctionnalité « cadeau » arrive bientôt. En attendant, vous pouvez acheter le cours puis partager les identifiants de connexion avec le bénéficiaire (sous votre responsabilité).",
      },
    ],
  },
  {
    id: "apprentissage",
    title: "Apprentissage et progression",
    icon: GraduationCap,
    description: "Accès aux cours, certificats, lecture vidéo.",
    items: [
      {
        q: "Combien de temps ai-je accès à un cours acheté ?",
        a: "À vie. Une fois acheté, le cours reste dans votre bibliothèque « Mon apprentissage » sans limite de durée. Vous pouvez le suivre à votre rythme et revenir autant de fois que nécessaire.",
      },
      {
        q: "Puis-je suivre un cours sur mobile ?",
        a: "Oui. Le site est responsive et fonctionne sur smartphone, tablette et ordinateur. La lecture reprend automatiquement où vous l'avez laissée d'un appareil à l'autre.",
      },
      {
        q: "Comment obtenir mon certificat ?",
        a: "Le certificat est généré automatiquement dès que vous avez complété 100 % des leçons d'un cours. Téléchargeable en PDF depuis votre profil. Chaque certificat est vérifiable publiquement via un numéro de série unique.",
      },
      {
        q: "Comment fonctionne le tuteur IA ?",
        a: "Chaque leçon dispose d'un onglet « Tuteur IA » où vous pouvez poser une question contextuelle (limite : 10 questions/heure). L'IA s'appuie sur le contenu de la leçon pour vous répondre.",
      },
      {
        q: "Puis-je télécharger les vidéos pour les regarder hors-ligne ?",
        a: "Le téléchargement vidéo n'est pas autorisé pour respecter les droits des formateurs. En revanche, certains cours proposent des PDF ou des ressources téléchargeables (visibles dans l'onglet « Ressources » de chaque leçon).",
      },
    ],
  },
  {
    id: "formateurs",
    title: "Devenir formateur",
    icon: GraduationCap,
    description: "Création de cours, rémunération, support formateur.",
    items: [
      {
        q: "Qui peut publier un cours sur Gandal ?",
        a: "Toute personne ayant une expertise à partager. Inscrivez-vous, puis activez votre compte formateur depuis « Devenir formateur ». Votre premier cours doit passer une étape de modération qui dure 2 à 5 jours ouvrés.",
      },
      {
        q: "Comment suis-je rémunéré ?",
        a: "Vous touchez 70 % du prix de vente (commission plateforme = 30 %) si la vente vient du catalogue Gandal. Vous touchez 85 % (commission = 15 %) si la vente vient de votre lien d'affiliation personnel.",
      },
      {
        q: "Quand suis-je payé ?",
        a: "Les paiements sont versés via Stripe Connect (Express) au plus tard le 5 du mois suivant la vente, après la fenêtre de remboursement de 30 jours. Configurez vos coordonnées bancaires depuis « Formateur → Paiements ».",
      },
      {
        q: "Puis-je créer mes propres codes promo ?",
        a: "Oui. Depuis « Formateur → Codes promo », créez des codes ciblés sur vos cours uniquement. La remise est imputée à votre part (la commission plateforme reste calculée sur le prix initial).",
      },
    ],
  },
  {
    id: "securite",
    title: "Sécurité et données",
    icon: ShieldCheck,
    description: "Confidentialité, données personnelles, signalements.",
    items: [
      {
        q: "Mes données sont-elles sécurisées ?",
        a: "Oui. Mots de passe hashés en bcrypt (cost 12), sessions JWT signées, vérification multi-couche des emails, rate-limiting anti-bruteforce. Aucune donnée bancaire n'est stockée chez nous (Stripe / CinetPay s'en chargent).",
      },
      {
        q: "Comment signaler un cours problématique ou un comportement abusif ?",
        a: "Chaque cours, avis ou question dispose d'un bouton « Signaler ». L'équipe modération examine chaque signalement sous 48h ouvrées.",
      },
      {
        q: "Comment exercer mes droits RGPD ?",
        a: "Pour demander un export de vos données ou leur suppression, contactez-nous via la page Contact en précisant « Demande RGPD ». Nous répondons sous 30 jours.",
      },
    ],
  },
];

// JSON-LD FAQPage pour rich snippets Google sur les SERP.
function buildFaqJsonLd() {
  const allItems = SECTIONS.flatMap((section) => section.items);
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: allItems.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export default function HelpCenterPage() {
  // Index plat searchable depuis tous les items des sections.
  const searchIndex: HelpSearchItem[] = SECTIONS.flatMap((section) =>
    section.items.map((item) => ({
      q: item.q,
      a: item.a,
      sectionId: section.id,
      sectionTitle: section.title,
    })),
  );

  return (
    <>
      <JsonLd id="faq-jsonld" data={buildFaqJsonLd()} />
      <SiteHeader />

      <main className="flex-1 bg-muted/20 py-8">
        <Container className="space-y-8">
          <Breadcrumbs items={[{ label: "Accueil", href: "/" }, { label: "Centre d'aide" }]} />

          {/* Hero + recherche */}
          <header className="rounded-2xl bg-gradient-to-br from-[color:var(--brand-primary)] via-[color:var(--brand-violet-deep)] to-[color:var(--brand-violet)] p-8 text-white md:p-12">
            <div className="mx-auto max-w-2xl text-center">
              <LifeBuoy className="mx-auto h-10 w-10 text-white/80" aria-hidden />
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Centre d&apos;aide
              </h1>
              <p className="mt-3 text-base text-white/80">
                Trouvez rapidement des réponses aux questions les plus fréquentes.
              </p>
              <div className="mt-6">
                <HelpSearch items={searchIndex} />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <Button
                  asChild
                  variant="outline"
                  className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/contact">
                    <Mail className="h-4 w-4" />
                    Contacter le support
                  </Link>
                </Button>
              </div>
            </div>
          </header>

          {/* Sommaire des sections — ancres internes */}
          <nav aria-label="Sommaire" className="rounded-lg border border-border bg-card p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Parcourir par catégorie
            </p>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                return (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-[color:var(--brand-primary)]" aria-hidden />
                      <span>{section.title}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Sections FAQ */}
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <section key={section.id} id={section.id} aria-labelledby={`heading-${section.id}`}>
                <header className="mb-4 flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-primary)]/10 text-[color:var(--brand-primary)]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h2
                      id={`heading-${section.id}`}
                      className="text-xl font-semibold text-foreground"
                    >
                      {section.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </div>
                </header>

                <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                  {section.items.map((item, index) => (
                    <li key={index}>
                      <details className="group">
                        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/40">
                          <span className="text-sm font-medium text-foreground">{item.q}</span>
                          <ChevronDown
                            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                            aria-hidden
                          />
                        </summary>
                        <div className="border-t border-border bg-muted/20 px-5 py-4 text-sm leading-6 text-muted-foreground">
                          {item.a}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {/* CTA final */}
          <Card className="bg-gradient-to-br from-[color:var(--brand-secondary)]/10 to-card">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
              <div>
                <p className="text-base font-semibold text-foreground">
                  Vous n&apos;avez pas trouvé votre réponse ?
                </p>
                <p className="text-sm text-muted-foreground">
                  L&apos;équipe support répond sous 24h ouvrées.
                </p>
              </div>
              <Button asChild>
                <Link href="/contact">
                  <Mail className="h-4 w-4" />
                  Contacter le support
                </Link>
              </Button>
            </CardContent>
          </Card>
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}
