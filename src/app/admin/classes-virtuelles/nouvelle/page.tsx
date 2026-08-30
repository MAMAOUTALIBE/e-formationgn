import type { Metadata } from "next";
import Link from "next/link";

import { VirtualClassForm } from "@/components/features/virtual-classes/virtual-class-form";
import { Button } from "@/components/ui/button";
import { virtualClassPersonName } from "@/lib/virtual-class-display";
import { listVirtualClassFormOptions } from "@/server/queries/virtual-classes";

export const metadata: Metadata = { title: "Nouvelle classe virtuelle" };

export default async function NewVirtualClassPage() {
  const options = await listVirtualClassFormOptions();
  return <div className="mx-auto max-w-5xl space-y-5"><header className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">Créer une classe virtuelle</h1><p className="text-sm text-muted-foreground">La salle restera privée et liée à une session existante.</p></div><Button asChild variant="outline"><Link href="/admin/classes-virtuelles">Retour</Link></Button></header><VirtualClassForm values={{ title: "", description: "", agenda: "", trainingSessionId: "", instructorId: "", startsAt: "", durationMinutes: 60, timezone: "Europe/Paris", maxParticipants: null, earlyJoinMinutes: 15, recordingEnabled: false, status: "DRAFT" }} sessions={options.sessions.map((session) => ({ id: session.id, label: `${session.program.title} · ${session.reference}` }))} instructors={options.instructors.map((person) => ({ id: person.id, label: virtualClassPersonName(person) }))} /></div>;
}
