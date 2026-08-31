import type { Metadata } from "next";
import { CalendarDays, Clock3, Download, FileText, MessageSquareText, UsersRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { VirtualClassAdminActions } from "@/components/features/virtual-classes/virtual-class-admin-actions";
import { VirtualClassStatus } from "@/components/features/virtual-classes/virtual-class-status";
import { VirtualClassResourceManager } from "@/components/features/virtual-classes/virtual-class-resource-manager";
import { VirtualClassReplayManager } from "@/components/features/virtual-classes/virtual-class-replay-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDurationSeconds, formatVirtualClassDate, virtualClassPersonName } from "@/lib/virtual-class-display";
import { getVirtualClassDetail } from "@/server/queries/virtual-classes";

export const metadata: Metadata = { title: "Détail de la classe virtuelle" };
export const dynamic = "force-dynamic";

const attendanceLabels: Record<string, string> = { EXPECTED: "Attendu", PRESENT: "Présent", PARTIAL: "Partiel", ABSENT: "Absent", EXCUSED: "Excusé" };

export default async function AdminVirtualClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getVirtualClassDetail(id);
  if (!item) notFound();
  const learners = item.attendances.filter((attendance) => attendance.role === "STUDENT");
  const present = learners.filter((attendance) => attendance.firstJoinedAt).length;

  return (
    <div className="min-w-0 space-y-6">
      <header className="space-y-4 rounded-2xl border bg-gradient-to-br from-emerald-50 via-card to-blue-50 p-5 shadow-sm dark:from-emerald-950/20 dark:to-blue-950/20 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><VirtualClassStatus status={item.status} /><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.trainingSession.reference}</span></div><h1 className="break-words text-2xl font-semibold sm:text-3xl">{item.title}</h1><p className="mt-2 text-sm text-muted-foreground">{item.trainingSession.program.title}</p></div>
          <VirtualClassAdminActions id={item.id} status={item.status} canDelete={item.status === "DRAFT"} />
        </div>
        <div className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-2 xl:grid-cols-4"><span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[color:var(--brand-primary)]" />{formatVirtualClassDate(item.startsAt, item.timezone)}</span><span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-[color:var(--brand-primary)]" />{item.durationMinutes} minutes</span><span className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-[color:var(--brand-primary)]" />{learners.length} apprenant{learners.length > 1 ? "s" : ""} attendu{learners.length > 1 ? "s" : ""}</span><span className="font-medium">Formateur : {virtualClassPersonName(item.instructor)}</span></div>
        {item.cancellationReason ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">Motif de l’annulation : {item.cancellationReason}</p> : null}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<UsersRound className="h-5 w-5" />} label="Participants attendus" value={learners.length} />
        <Metric icon={<UsersRound className="h-5 w-5" />} label="Ont rejoint" value={present} />
        <Metric icon={<FileText className="h-5 w-5" />} label="Documents" value={item.resources.length} />
        <Metric icon={<MessageSquareText className="h-5 w-5" />} label="Questions et messages" value={item.messages.length} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <Card className="min-w-0 overflow-hidden"><CardHeader className="flex-row items-center justify-between"><CardTitle>Feuille de présence</CardTitle><Button asChild variant="outline" size="sm"><Link href={`/api/classes-virtuelles/${id}/presence`}><Download className="h-4 w-4" />Exporter</Link></Button></CardHeader><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[680px] text-sm"><thead className="border-y bg-muted/40 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3">Participant</th><th className="px-5 py-3">Statut</th><th className="px-5 py-3">Connexions</th><th className="px-5 py-3">Durée réelle</th><th className="px-5 py-3">Première entrée</th></tr></thead><tbody className="divide-y">{learners.map((attendance) => <tr key={attendance.id}><td className="px-5 py-3"><strong className="block">{virtualClassPersonName(attendance.user)}</strong><span className="text-xs text-muted-foreground">{attendance.user.email}</span></td><td className="px-5 py-3">{attendanceLabels[attendance.status] ?? attendance.status}</td><td className="px-5 py-3">{attendance.connectionCount}{deviceLabel(attendance.deviceInfo) ? <span className="block text-xs text-muted-foreground">{deviceLabel(attendance.deviceInfo)}</span> : null}</td><td className="px-5 py-3">{formatDurationSeconds(attendance.totalSeconds)}</td><td className="px-5 py-3">{attendance.firstJoinedAt ? formatVirtualClassDate(attendance.firstJoinedAt, item.timezone) : "—"}</td></tr>)}</tbody></table>{!learners.length ? <p className="p-5 text-sm text-muted-foreground">Aucun apprenant attendu pour cette session.</p> : null}</CardContent></Card>

        <div className="space-y-6">
          <Card><CardHeader><CardTitle>Contenu de la séance</CardTitle></CardHeader><CardContent className="space-y-4 text-sm">{item.description ? <div><h3 className="font-semibold">Description</h3><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{item.description}</p></div> : null}{item.agenda ? <div><h3 className="font-semibold">Programme</h3><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{item.agenda}</p></div> : null}{!item.description && !item.agenda ? <p className="text-muted-foreground">Aucune description ni programme.</p> : null}</CardContent></Card>
          <Card><CardHeader><CardTitle>Documents</CardTitle></CardHeader><CardContent><VirtualClassResourceManager virtualClassId={id} resources={item.resources} disabled={["ENDED", "CANCELLED"].includes(item.status)} /></CardContent></Card>
          <Card><CardHeader><CardTitle>Replay</CardTitle></CardHeader><CardContent><VirtualClassReplayManager virtualClassId={id} recordings={item.recordings} /></CardContent></Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Environnement du participant, relevé au moment où son jeton a été délivré.
 * Sert au support : « pas de son » n'a pas la même cause sur Safari iOS que
 * sur Chrome Windows.
 */
function deviceLabel(deviceInfo: unknown): string | null {
  if (!deviceInfo || typeof deviceInfo !== "object") return null;
  const info = deviceInfo as { browser?: unknown; os?: unknown; mobile?: unknown };
  if (typeof info.browser !== "string" || typeof info.os !== "string") return null;
  return `${info.browser} · ${info.os}${info.mobile ? " · mobile" : ""}`;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><span className="rounded-lg bg-[color:var(--brand-primary)]/10 p-2 text-[color:var(--brand-primary)]">{icon}</span><span><strong className="block text-xl">{value}</strong><span className="text-xs text-muted-foreground">{label}</span></span></CardContent></Card>;
}
