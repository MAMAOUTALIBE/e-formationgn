import { CalendarDays, FileText, UsersRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { VirtualClassStatus } from "@/components/features/virtual-classes/virtual-class-status";
import { VirtualClassResourceManager } from "@/components/features/virtual-classes/virtual-class-resource-manager";
import { VirtualClassInstructorActions } from "@/components/features/virtual-classes/virtual-class-instructor-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDurationSeconds, formatVirtualClassDate, virtualClassPersonName } from "@/lib/virtual-class-display";
import { getVirtualClassDetail } from "@/server/queries/virtual-classes";

export default async function InstructorVirtualClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  const { id } = await params;
  const item = await getVirtualClassDetail(id);
  if (!item) notFound();
  if (item.instructorId !== session.user.id && session.user.role !== "ADMIN") notFound();
  const learners = item.attendances.filter((attendance) => attendance.role === "STUDENT");
  return <div className="space-y-6"><header className="rounded-2xl border bg-gradient-to-br from-emerald-50 to-blue-50 p-5 shadow-sm dark:from-emerald-950/20 dark:to-blue-950/20"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><VirtualClassStatus status={item.status} /><h1 className="mt-3 text-2xl font-semibold">{item.title}</h1><p className="mt-1 text-sm text-muted-foreground">{item.trainingSession.program.title} · {item.trainingSession.reference}</p></div><VirtualClassInstructorActions id={id} status={item.status} /></div><p className="mt-4 flex items-center gap-2 border-t pt-4 text-sm"><CalendarDays className="h-4 w-4" />{formatVirtualClassDate(item.startsAt, item.timezone)} · {item.durationMinutes} minutes</p></header><div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5" />Participants attendus ({learners.length})</CardTitle></CardHeader><CardContent className="space-y-2">{learners.map((attendance) => <div key={attendance.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"><span className="min-w-0"><strong className="block truncate">{virtualClassPersonName(attendance.user)}</strong><span className="block truncate text-xs text-muted-foreground">{attendance.user.email}</span></span><span className="shrink-0 text-xs text-muted-foreground">{attendance.firstJoinedAt ? formatDurationSeconds(attendance.totalSeconds) : "Attendu"}</span></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Ressources et replay</CardTitle></CardHeader><CardContent className="space-y-4"><VirtualClassResourceManager virtualClassId={id} resources={item.resources} disabled={["ENDED", "CANCELLED"].includes(item.status)} /><p className="text-sm text-muted-foreground">{item.messages.length} message{item.messages.length > 1 ? "s" : ""} ou question · {item.recordings.length} enregistrement{item.recordings.length > 1 ? "s" : ""}.</p></CardContent></Card></div>{item.agenda ? <Card><CardHeader><CardTitle>Programme</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.agenda}</p></CardContent></Card> : null}</div>;
}
