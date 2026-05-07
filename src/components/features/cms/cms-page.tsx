import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";

interface CmsPageViewProps {
  title: string;
  body: string;
}

export function CmsPageView({ title, body }: CmsPageViewProps) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-muted/20 py-10">
        <Container className="max-w-3xl space-y-6">
          <Breadcrumbs items={[{ label: "Accueil", href: "/" }, { label: title }]} />
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
          <article className="prose prose-sm max-w-none whitespace-pre-line text-foreground">
            {body}
          </article>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
