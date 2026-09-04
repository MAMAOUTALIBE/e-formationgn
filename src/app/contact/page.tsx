import type { Metadata } from "next";

import { ContactAssistant } from "@/components/features/contact/contact-assistant";
import { SiteHeader } from "@/components/layout/site-header";
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
      <main className="contact-view flex min-h-0 flex-1 overflow-hidden bg-muted/20 py-2 sm:py-3">
        <Container className="flex h-full min-h-0 max-w-6xl">
          <h1 className="sr-only">{page.title}</h1>

          <div className="grid min-h-0 flex-1 items-stretch gap-3 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.75fr)]">
            <ContactAssistant
              assistantAvailable={isAiducaAssistantConfigured()}
            />

            <aside className="hidden min-h-0 overflow-y-auto rounded-2xl border border-border bg-background p-5 shadow-sm lg:block">
              <h2 className="text-base font-semibold text-foreground">
                Contacter directement Aiduca
              </h2>
              <article className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                {page.body}
              </article>
            </aside>
          </div>
        </Container>
      </main>
    </>
  );
}
