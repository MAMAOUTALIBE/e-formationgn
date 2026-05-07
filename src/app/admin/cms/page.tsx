import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/prisma";
import { deleteCmsPage, upsertCmsPage } from "@/server/actions/admin";

export const metadata: Metadata = {
  title: "Pages CMS",
};

export const dynamic = "force-dynamic";

const SUGGESTED_SLUGS = [
  { slug: "cgv", title: "Conditions générales de vente" },
  { slug: "mentions-legales", title: "Mentions légales" },
  { slug: "confidentialite", title: "Politique de confidentialité" },
  { slug: "cookies", title: "Politique cookies" },
  { slug: "a-propos", title: "À propos" },
  { slug: "contact", title: "Contact" },
];

export default async function AdminCmsPage() {
  const pages = await prisma.cmsPage.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Pages éditoriales
        </h1>
        <p className="text-sm text-muted-foreground">
          CGV, mentions légales, RGPD… Tout texte affiché publiquement sur la
          plateforme.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pages existantes</CardTitle>
          </CardHeader>
          <CardContent>
            {pages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune page personnalisée. Les pages publiques utilisent leur
                contenu par défaut tant qu&apos;aucune page CMS n&apos;est créée
                pour leur slug.
              </p>
            ) : (
              <ul className="space-y-2">
                {pages.map((page) => (
                  <li
                    key={page.id}
                    className="rounded-md border border-border p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">
                          {page.title}{" "}
                          {page.isPublished ? (
                            <Badge variant="success">Publié</Badge>
                          ) : (
                            <Badge variant="outline">Brouillon</Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">/{page.slug}</p>
                      </div>
                      <form
                        action={async () => {
                          "use server";
                          await deleteCmsPage(page.id);
                        }}
                      >
                        <Button type="submit" variant="outline" size="sm">
                          Supprimer
                        </Button>
                      </form>
                    </div>
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-muted-foreground">
                        Modifier
                      </summary>
                      <CmsForm
                        defaults={{
                          id: page.id,
                          slug: page.slug,
                          title: page.title,
                          body: page.body,
                          isPublished: page.isPublished,
                        }}
                      />
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nouvelle page</CardTitle>
          </CardHeader>
          <CardContent>
            <CmsForm />
            <div className="mt-4 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Slugs recommandés :</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {SUGGESTED_SLUGS.map((s) => (
                  <li key={s.slug}>
                    <code>{s.slug}</code> — {s.title}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CmsForm({
  defaults,
}: {
  defaults?: { id: string; slug: string; title: string; body: string; isPublished: boolean };
}) {
  return (
    <form
      action={async (formData: FormData) => {
        "use server";
        await upsertCmsPage(formData);
      }}
      className="space-y-3"
    >
      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <FormField id="slug" label="Slug" required>
        <Input
          id="slug"
          name="slug"
          required
          maxLength={80}
          pattern="[a-z0-9-]+"
          defaultValue={defaults?.slug}
        />
      </FormField>
      <FormField id="title" label="Titre" required>
        <Input id="title" name="title" required maxLength={160} defaultValue={defaults?.title} />
      </FormField>
      <FormField id="body" label="Contenu" required hint="Markdown supporté">
        <Textarea
          id="body"
          name="body"
          rows={10}
          required
          minLength={10}
          maxLength={50_000}
          defaultValue={defaults?.body}
        />
      </FormField>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isPublished"
          defaultChecked={defaults?.isPublished ?? false}
        />{" "}
        Publier la page
      </label>
      <Button type="submit" className="w-full">
        Enregistrer
      </Button>
    </form>
  );
}
