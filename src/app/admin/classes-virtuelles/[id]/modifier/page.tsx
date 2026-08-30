import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { VirtualClassForm } from "@/components/features/virtual-classes/virtual-class-form";
import { Button } from "@/components/ui/button";
import { dateTimeLocalValue, virtualClassPersonName } from "@/lib/virtual-class-display";
import { getVirtualClassDetail, listVirtualClassFormOptions } from "@/server/queries/virtual-classes";

export const metadata: Metadata = { title: "Modifier la classe virtuelle" };

export default async function EditVirtualClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, options] = await Promise.all([getVirtualClassDetail(id), listVirtualClassFormOptions()]);
  if (!item) notFound();
  if (item.status !== "DRAFT" && item.status !== "SCHEDULED") redirect(`/admin/classes-virtuelles/${id}`);
  return <div className="mx-auto max-w-5xl space-y-5"><header className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">Modifier la classe virtuelle</h1><p className="text-sm text-muted-foreground">Reprogrammez la séance sans changer son accès privé.</p></div><Button asChild variant="outline"><Link href={`/admin/classes-virtuelles/${id}`}>Annuler</Link></Button></header><VirtualClassForm virtualClassId={id} values={{ title: item.title, description: item.description, agenda: item.agenda, trainingSessionId: item.trainingSessionId, instructorId: item.instructorId, startsAt: dateTimeLocalValue(item.startsAt), durationMinutes: item.durationMinutes, timezone: item.timezone, maxParticipants: item.maxParticipants, earlyJoinMinutes: item.earlyJoinMinutes, recordingEnabled: item.recordingEnabled, status: item.status }} sessions={options.sessions.map((session) => ({ id: session.id, label: `${session.program.title} · ${session.reference}` }))} instructors={options.instructors.map((person) => ({ id: person.id, label: virtualClassPersonName(person) }))} /></div>;
}
