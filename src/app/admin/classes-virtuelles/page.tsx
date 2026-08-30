import type { Metadata } from "next";
import { CalendarDays, List, Plus, Search, Video } from "lucide-react";
import Link from "next/link";

import { VirtualClassCard } from "@/components/features/virtual-classes/virtual-class-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatVirtualClassShortDate, virtualClassPersonName } from "@/lib/virtual-class-display";
import { listAdminVirtualClasses, listVirtualClassFormOptions, VIRTUAL_CLASS_LIST_STATUSES } from "@/server/queries/virtual-classes";

export const metadata: Metadata = { title: "Classes virtuelles — Administration" };
export const dynamic = "force-dynamic";

export default async function AdminVirtualClassesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const view = params.view === "calendar" ? "calendar" : "list";
  const [items, options] = await Promise.all([
    listAdminVirtualClasses({
      q: params.q,
      status: params.status,
      programId: params.programId,
      sessionId: params.sessionId,
      instructorId: params.instructorId,
      from: params.from ? new Date(`${params.from}T00:00:00`) : undefined,
      to: params.to ? new Date(`${params.to}T23:59:59`) : undefined,
    }),
    listVirtualClassFormOptions(),
  ]);
  const programs = [...new Map(options.sessions.map((session) => [session.program.title, session.program])).values()];

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-semibold">Classes virtuelles</h1><p className="text-sm text-muted-foreground">Planifiez et suivez les cours en direct de chaque session.</p></div>
        <Button asChild><Link href="/admin/classes-virtuelles/nouvelle"><Plus className="h-4 w-4" />Créer une classe virtuelle</Link></Button>
      </header>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input type="hidden" name="view" value={view} />
          <div className="relative xl:col-span-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input name="q" defaultValue={params.q} placeholder="Titre de la classe…" className="pl-9" /></div>
          <Select name="status" defaultValue={params.status ?? ""} aria-label="Statut"><option value="">Tous les statuts</option>{VIRTUAL_CLASS_LIST_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</Select>
          <Select name="sessionId" defaultValue={params.sessionId ?? ""} aria-label="Session"><option value="">Toutes les sessions</option>{options.sessions.map((session) => <option key={session.id} value={session.id}>{session.reference}</option>)}</Select>
          <Select name="instructorId" defaultValue={params.instructorId ?? ""} aria-label="Formateur"><option value="">Tous les formateurs</option>{options.instructors.map((person) => <option key={person.id} value={person.id}>{virtualClassPersonName(person)}</option>)}</Select>
          <Select name="programId" defaultValue={params.programId ?? ""} aria-label="Formation"><option value="">Toutes les formations</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.title}</option>)}</Select>
          <Input name="from" type="date" defaultValue={params.from} aria-label="Date de début" />
          <Input name="to" type="date" defaultValue={params.to} aria-label="Date de fin" />
          <div className="flex gap-2 xl:col-span-4"><Button type="submit" variant="outline">Filtrer</Button><Button asChild variant="ghost"><Link href={`/admin/classes-virtuelles?view=${view}`}>Réinitialiser</Link></Button></div>
        </form>
      </section>

      <div className="flex justify-end gap-2">
        <Button asChild variant={view === "list" ? "default" : "outline"} size="sm"><Link href="/admin/classes-virtuelles?view=list"><List className="h-4 w-4" />Liste</Link></Button>
        <Button asChild variant={view === "calendar" ? "default" : "outline"} size="sm"><Link href="/admin/classes-virtuelles?view=calendar"><CalendarDays className="h-4 w-4" />Calendrier</Link></Button>
      </div>

      {!items.length ? <EmptyState icon={<Video className="h-6 w-6" />} title="Aucune classe virtuelle" description="Programmez une séance ou modifiez les filtres." /> : view === "list" ? (
        <div className="grid gap-4 xl:grid-cols-2">{items.map((item) => <VirtualClassCard key={item.id} item={item} detailHref={`/admin/classes-virtuelles/${item.id}`} attendanceLabel={`${item._count.attendances} attendu${item._count.attendances > 1 ? "s" : ""}`} />)}</div>
      ) : (
        <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => <Link key={item.id} href={`/admin/classes-virtuelles/${item.id}`} className="min-w-0 rounded-lg border-l-4 border-l-[color:var(--brand-primary)] bg-muted/35 p-3 transition hover:bg-muted"><span className="block text-xs font-semibold text-muted-foreground">{formatVirtualClassShortDate(item.startsAt, item.timezone)}</span><strong className="mt-1 block break-words text-sm">{item.title}</strong><span className="mt-1 block truncate text-xs text-muted-foreground">{item.trainingSession.program.title}</span></Link>)}
        </div>
      )}
    </div>
  );
}
