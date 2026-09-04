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
import { HELP_FAQ_SECTIONS, type HelpFaqItem } from "@/lib/help-faq";

export const metadata: Metadata = {
  title: "Centre d'aide",
  description:
    "Trouvez rapidement des réponses sur Aiduca : compte, accès aux formations, apprentissage et formateurs.",
  alternates: { canonical: "/aide" },
};

interface FaqSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  items: HelpFaqItem[];
}

// Le contenu vit dans @/lib/help-faq (partagé avec la base documentaire de
// Aiduca-IA) ; seule l'illustration reste ici, où le JSX a sa place.
const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  compte: User,
  apprentissage: GraduationCap,
  formateurs: GraduationCap,
  securite: ShieldCheck,
};

const SECTIONS: FaqSection[] = HELP_FAQ_SECTIONS.map((section) => ({
  ...section,
  icon: SECTION_ICONS[section.id] ?? LifeBuoy,
}));

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
