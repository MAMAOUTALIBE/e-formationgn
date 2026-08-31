import { CalendarDays, Clock3, FileText, PlayCircle, Radio, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { AccountShell } from "@/components/features/workspace/account-shell";
import { VirtualClassStatus } from "@/components/features/virtual-classes/virtual-class-status";
import { VirtualClassCountdown } from "@/components/features/virtual-classes/virtual-class-countdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { formatVirtualClassDate, virtualClassPersonName } from "@/lib/virtual-class-display";
import { getVirtualClassViewer } from "@/server/queries/virtual-classes";

export default async function VirtualClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  const { id } = await params;
  const item = await getVirtualClassViewer(id, session.user.id, session.user.role);
  if (!item) notFound();
  const joinable = item.status === "OPEN" || item.status === "LIVE";
  return <AccountShell callbackUrl={`/classes-virtuelles/${id}`}><Container className="space-y-6"><header className="overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-50 via-card to-blue-50 p-5 shadow-sm dark:from-emerald-950/20 dark:to-blue-950/20 sm:p-7"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><VirtualClassStatus status={item.status} />{item.status === "LIVE" ? <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600"><Radio className="h-3.5 w-3.5" />EN DIRECT</span> : null}</div><h1 className="mt-3 break-words text-2xl font-semibold sm:text-3xl">{item.title}</h1><p className="mt-2 text-sm text-muted-foreground">{item.trainingSession.program.title} · {item.trainingSession.reference}</p>{item.status === "SCHEDULED" ? <VirtualClassCountdown startsAt={item.startsAt.toISOString()} /> : null}</div><div className="flex shrink-0 flex-col gap-2">{joinable ? <Button asChild size="lg"><Link href={`/classes-virtuelles/${id}/verification`}>{item.status === "LIVE" ? "Classe en cours" : "Rejoindre la classe"}</Link></Button> : item.replayId ? <Button asChild size="lg"><Link href={`/api/classes-virtuelles/${id}/replay/${item.replayId}`}><PlayCircle className="h-4 w-4" />Voir le replay</Link></Button> : <Button disabled size="lg">{item.status === "CANCELLED" ? "Séance annulée" : item.status === "ENDED" ? "Séance terminée" : "À venir"}</Button>}</div></div><div className="mt-5 grid gap-3 border-t pt-4 text-sm sm:grid-cols-3"><span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{formatVirtualClassDate(item.startsAt, item.timezone)}</span><span className="flex items-center gap-2"><Clock3 className="h-4 w-4" />{Math.round((item.scheduledEndAt.getTime() - item.startsAt.getTime()) / 60_000)} min</span><span className="flex items-center gap-2"><UserRound className="h-4 w-4" />{virtualClassPersonName(item.instructor)}</span></div></header><div className="grid gap-6 lg:grid-cols-[1fr_360px]"><Card><CardHeader><CardTitle>À propos de la séance</CardTitle></CardHeader><CardContent className="space-y-4 text-sm">{item.description ? <p className="whitespace-pre-wrap text-muted-foreground">{item.description}</p> : <p className="text-muted-foreground">Aucune description.</p>}{item.agenda ? <div><h2 className="font-semibold">Programme</h2><p className="mt-2 whitespace-pre-wrap text-muted-foreground">{item.agenda}</p></div> : null}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Documents préparatoires</CardTitle></CardHeader><CardContent className="space-y-2">{item.resources.filter((resource) => resource.visibility === "BEFORE" || resource.visibility === "ALWAYS").map((resource) => <Button key={resource.id} asChild variant="outline" className="w-full justify-start"><Link href={`/api/classes-virtuelles/${id}/ressources/${resource.id}`}><FileText className="h-4 w-4" /><span className="truncate">{resource.title}</span></Link></Button>)}{!item.resources.some((resource) => resource.visibility === "BEFORE" || resource.visibility === "ALWAYS") ? <p className="text-sm text-muted-foreground">Aucun document préparatoire.</p> : null}</CardContent></Card></div></Container></AccountShell>;
}
