import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createModerationRule,
  deleteModerationRule,
  toggleModerationRule,
} from "@/server/actions/admin-moderation";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Règles de modération" };

export const dynamic = "force-dynamic";

export default async function ModerationRulesPage() {
  const rules = await prisma.moderationRule.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Règles de modération
        </h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Règles existantes</CardTitle>
          </CardHeader>
          <CardContent>
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune règle.</p>
            ) : (
              <ul className="divide-y divide-border">
                {rules.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.kind} · <code>{r.pattern}</code> · action {r.action}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <form
                        action={async () => {
                          "use server";
                          await toggleModerationRule(r.id, !r.isActive);
                        }}
                      >
                        <Button type="submit" size="sm" variant="outline">
                          {r.isActive ? "Désactiver" : "Activer"}
                        </Button>
                      </form>
                      <form
                        action={async () => {
                          "use server";
                          await deleteModerationRule(r.id);
                        }}
                      >
                        <Button type="submit" size="sm" variant="outline">
                          Supprimer
                        </Button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nouvelle règle</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={async (formData: FormData) => {
                "use server";
                await createModerationRule(formData);
              }}
              className="space-y-3"
            >
              <FormField id="name" label="Nom">
                <Input id="name" name="name" required />
              </FormField>
              <FormField id="kind" label="Type">
                <Select id="kind" name="kind" defaultValue="KEYWORD">
                  <option value="KEYWORD">Mot-clé</option>
                  <option value="REGEX">Regex</option>
                </Select>
              </FormField>
              <FormField id="pattern" label="Pattern">
                <Input id="pattern" name="pattern" required />
              </FormField>
              <FormField id="action" label="Action">
                <Select id="action" name="action" defaultValue="FLAG">
                  <option value="FLAG">Signaler</option>
                  <option value="HIDE">Masquer</option>
                  <option value="BLOCK">Bloquer</option>
                </Select>
              </FormField>
              <Button type="submit" size="sm" className="w-full">
                Créer
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
