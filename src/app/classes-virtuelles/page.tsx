import type { Metadata } from "next";
import { History, Radio, Video } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { VirtualClassCard } from "@/components/features/virtual-classes/virtual-class-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Container } from "@/components/ui/container";
import { listStudentVirtualClasses } from "@/server/queries/virtual-classes";

export const metadata: Metadata = { title: "Mes classes virtuelles" };
export const dynamic = "force-dynamic";

export default async function StudentVirtualClassesPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion?callbackUrl=/classes-virtuelles");
  const all = await listStudentVirtualClasses(session.user.id);
  const items = all.filter((item) => item.registrationStatus === "ACTIVE");
  const upcoming = items.filter((item) => ["SCHEDULED", "OPEN", "LIVE"].includes(item.status));
  const past = items.filter((item) => ["ENDED", "CANCELLED"].includes(item.status));
  return <Container className="space-y-8"><header className="rounded-2xl border bg-gradient-to-br from-[color:var(--brand-primary)]/10 via-card to-blue-50 p-5 shadow-sm sm:p-7 dark:to-blue-950/20"><p className="text-xs font-bold uppercase tracking-[.14em] text-[color:var(--brand-primary)]">Cours en direct</p><h1 className="mt-2 text-3xl font-semibold">Mes classes virtuelles</h1><p className="mt-1 text-sm text-muted-foreground">Rejoignez uniquement les séances rattachées à vos inscriptions actives.</p></header>{upcoming.length ? <section><h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Radio className="h-5 w-5 text-red-500" />Prochain cours en direct</h2><div className="grid gap-4 xl:grid-cols-2">{upcoming.map((item) => <VirtualClassCard key={item.id} item={item} detailHref={`/classes-virtuelles/${item.id}`} joinHref={["OPEN", "LIVE"].includes(item.status) ? `/classes-virtuelles/${item.id}/verification` : undefined} attendanceLabel={item.attendance ? `Présence : ${item.attendance.status.toLowerCase()}` : undefined} />)}</div></section> : null}{past.length ? <section><h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><History className="h-5 w-5" />Séances passées</h2><div className="grid gap-4 xl:grid-cols-2">{past.map((item) => <VirtualClassCard key={item.id} item={item} detailHref={`/classes-virtuelles/${item.id}`} attendanceLabel={item.attendance ? `Présence : ${item.attendance.status.toLowerCase()}` : undefined} />)}</div></section> : null}{!items.length ? <EmptyState icon={<Video className="h-6 w-6" />} title="Aucune classe à afficher" description="Vos cours en direct apparaîtront ici lorsque votre inscription sera active." /> : null}</Container>;
}
