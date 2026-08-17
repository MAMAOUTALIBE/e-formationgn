import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronDown,
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
    "Trouvez rapidement des réponses sur Gandal : compte, accès aux formations, apprentissage et formateurs.",
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
        a: "Contactez le support via la page Contact. Votre demande sera traitée conformément à notre politique de confidentialité.",
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
        q: "Comment accéder à une formation ?",
        a: "Votre société ou le gestionnaire de formation vous inscrit à un programme. Les cours attribués apparaissent ensuite dans « Mon apprentissage ».",
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
    description: "Création de cours et accompagnement pédagogique.",
    items: [
      {
        q: "Qui peut publier un cours sur Gandal ?",
        a: "Les comptes formateurs sont créés et habilités par le gestionnaire de la plateforme. Les cours suivent ensuite le processus de validation pédagogique.",
      },
      {
        q: "Comment suivre les apprenants ?",
        a: "L'espace formateur permet de consulter l'activité pédagogique, les questions et les avis liés à vos cours.",
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
        a: "Oui. Les mots de passe sont hashés, les sessions signées et les accès protégés par rôle. La plateforme ne collecte aucune donnée bancaire.",
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
