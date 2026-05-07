import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import {
  createEmailCampaign,
  createEmailTemplate,
  deleteEmailTemplate,
} from "@/server/actions/admin-marketing";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Campagnes email" };

export const dynamic = "force-dynamic";

export default async function EmailCampaignsPage() {
  const [templates, campaigns] = await Promise.all([
    prisma.emailTemplate.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.emailCampaign.findMany({
      orderBy: { createdAt: "desc" },
      include: { template: { select: { name: true, slug: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Campagnes email
        </h1>
        <p className="text-sm text-muted-foreground">
          {templates.length} template{templates.length > 1 ? "s" : ""} ·{" "}
          {campaigns.length} campagne{campaigns.length > 1 ? "s" : ""}.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Templates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              action={async (formData: FormData) => {
                "use server";
                await createEmailTemplate(formData);
              }}
              className="space-y-3"
            >
              <FormField id="slug" label="Slug">
                <Input id="slug" name="slug" required pattern="[a-z0-9-]+" />
              </FormField>
              <FormField id="name" label="Nom">
                <Input id="name" name="name" required />
              </FormField>
              <FormField id="subject" label="Sujet">
                <Input id="subject" name="subject" required />
              </FormField>
              <FormField id="bodyText" label="Corps texte">
                <Textarea id="bodyText" name="bodyText" rows={4} required />
              </FormField>
              <FormField id="bodyHtml" label="Corps HTML (optionnel)">
                <Textarea id="bodyHtml" name="bodyHtml" rows={4} />
              </FormField>
              <Button type="submit" size="sm">Créer le template</Button>
            </form>

            <ul className="divide-y divide-border text-sm">
              {templates.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <code>{t.slug}</code> · {t.subject}
                    </p>
                  </div>
                  <form
                    action={async () => {
                      "use server";
                      await deleteEmailTemplate(t.id);
                    }}
                  >
                    <Button type="submit" size="sm" variant="outline">
                      Supprimer
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campagnes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              action={async (formData: FormData) => {
                "use server";
                await createEmailCampaign(formData);
              }}
              className="space-y-3"
            >
              <FormField id="name" label="Nom de la campagne">
                <Input id="name" name="name" required />
              </FormField>
              <FormField id="templateId" label="Template">
                <Select id="templateId" name="templateId" required>
                  <option value="">— Choisir —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField id="segment" label="Segment">
                <Select id="segment" name="segment" defaultValue="all">
                  <option value="all">Tous les utilisateurs</option>
                  <option value="students">Élèves uniquement</option>
                  <option value="instructors">Formateurs uniquement</option>
                  <option value="inactive_30d">Inactifs 30 j</option>
                  <option value="cart_abandoned">Paniers abandonnés</option>
                </Select>
              </FormField>
              <Button type="submit" size="sm">Créer la campagne (brouillon)</Button>
            </form>

            <ul className="divide-y divide-border text-sm">
              {campaigns.map((c) => (
                <li key={c.id} className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{c.name}</p>
                    <StatusBadge tone={c.status === "SENT" ? "success" : c.status === "FAILED" ? "danger" : "neutral"}>
                      {c.status}
                    </StatusBadge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Template : {c.template.name} · {c.totalDelivered} délivrés ·{" "}
                    {c.totalOpened} ouverts ({c.totalRecipients > 0 ? Math.round((c.totalOpened / c.totalRecipients) * 100) : 0} %)
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
