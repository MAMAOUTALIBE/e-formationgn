import type { Metadata } from "next";

import { ContactAssistant } from "@/components/features/contact/contact-assistant";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { isAiducaAssistantConfigured } from "@/lib/ai/assistant";
import { getCmsPage } from "@/lib/cms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCmsPage("contact");
  return { title: page.title, alternates: { canonical: "/contact" } };
}

export default async function ContactPage() {
  const page = await getCmsPage("contact");

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-muted/20 py-10">
        <Container className="max-w-6xl space-y-7">
          <Breadcrumbs
            items={[{ label: "Accueil", href: "/" }, { label: page.title }]}
          />

          <header className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {page.title}
            </h1>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Expliquez votre projet à Aiduca-IA. L&apos;assistant qualifie votre
              besoin pas à pas avant de le transmettre à un conseiller, uniquement
              avec votre accord.
            </p>
          </header>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.8fr)]">
            <ContactAssistant
              assistantAvailable={isAiducaAssistantConfigured()}
            />

            <aside className="rounded-3xl border border-border bg-background p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">
                Contacter directement Aiduca
              </h2>
              <article className="mt-4 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                {page.body}
              </article>
            </aside>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
