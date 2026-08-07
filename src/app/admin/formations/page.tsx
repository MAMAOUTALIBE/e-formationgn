import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { listPrograms } from "@/server/queries/admin-programs";

export const metadata: Metadata = { title: "Formations — CRM admin" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "neutral" }> = {
  DRAFT: { label: "Brouillon", tone: "warning" },
  ACTIVE: { label: "Active", tone: "success" },
  ARCHIVED: { label: "Archivée", tone: "neutral" },
};

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string }>;
}) {
  const params = await searchParams;
  const rows = await listPrograms({ search: params.q, status: params.statut });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Formations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Programmes pédagogiques regroupant plusieurs cours. Les élèves y sont
            inscrits via une session datée.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/formations/nouvelle">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            Nouvelle formation
          </Link>
        </Button>
      </header>

      <form className="flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-0 flex-1 sm:max-w-sm">
          <label htmlFor="q" className="mb-1 block text-xs font-medium text-muted-foreground">
            Rechercher
          </label>
          <Input id="q" name="q" defaultValue={params.q ?? ""} placeholder="Intitulé, code…" />
        </div>
        <div>
          <label htmlFor="statut" className="mb-1 block text-xs font-medium text-muted-foreground">
            Statut
          </label>
          <Select id="statut" name="statut" defaultValue={params.statut ?? ""}>
            <option value="">Tous</option>
            <option value="DRAFT">Brouillon</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archivée</option>
          </Select>
        </div>
        <Button type="submit" variant="outline">
          <Search className="mr-1.5 h-4 w-4" aria-hidden />
          Filtrer
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-6 w-6" aria-hidden />}
          title={params.q ? "Aucune formation trouvée" : "Aucune formation"}
          description="Une formation assemble plusieurs cours en un parcours, auquel on rattache des sessions datées."
          action={
            <Button asChild>
              <Link href="/admin/formations/nouvelle">Créer une formation</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Intitulé</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 text-right font-medium">Durée</th>
                <th className="px-4 py-3 text-right font-medium">Cours</th>
                <th className="px-4 py-3 text-right font-medium">Sessions</th>
                <th className="px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const badge = STATUS[p.status] ?? { label: p.status, tone: "neutral" as const };
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/formations/${p.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.code ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {p.durationHours ? `${p.durationHours} h` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.courseCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.sessionCount}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
