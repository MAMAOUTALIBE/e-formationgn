import type { Metadata } from "next";
import { CalendarClock, History, Video } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { VirtualClassCard } from "@/components/features/virtual-classes/virtual-class-card";
import { EmptyState } from "@/components/ui/empty-state";
import { listInstructorVirtualClasses } from "@/server/queries/virtual-classes";

export const metadata: Metadata = { title: "Mes classes virtuelles" };
export const dynamic = "force-dynamic";

export default async function InstructorVirtualClassesPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion?callbackUrl=/formateur/classes-virtuelles");
  const items = await listInstructorVirtualClasses(session.user.id);
  const upcoming = items.filter((item) => ["DRAFT", "SCHEDULED", "OPEN", "LIVE"].includes(item.status));
  const history = items.filter((item) => item.status === "ENDED");
  const cancelled = items.filter((item) => item.status === "CANCELLED");
  const next = upcoming.find((item) => item.status !== "DRAFT");

  return <div className="min-w-0 space-y-8"><header><h1 className="text-2xl font-semibold">Mes classes virtuelles</h1><p className="text-sm text-muted-foreground">Préparez et animez uniquement les séances qui vous sont attribuées.</p></header>{next ? <section><h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><CalendarClock className="h-5 w-5 text-[color:var(--brand-primary)]" />Prochaine classe</h2><VirtualClassCard item={next} detailHref={`/formateur/classes-virtuelles/${next.id}`} prepareHref={`/classes-virtuelles/${next.id}/verification`} joinHref={`/classes-virtuelles/${next.id}/verification`} attendanceLabel={`${next._count.attendances} attendu${next._count.attendances > 1 ? "s" : ""}`} /></section> : null}<VirtualClassGroup title="Séances à venir" icon={<Video className="h-5 w-5" />} items={upcoming} /><VirtualClassGroup title="Historique" icon={<History className="h-5 w-5" />} items={history} /><VirtualClassGroup title="Séances annulées" icon={<History className="h-5 w-5" />} items={cancelled} />{!items.length ? <EmptyState icon={<Video className="h-6 w-6" />} title="Aucune classe attribuée" description="Vos prochaines classes virtuelles apparaîtront ici." /> : null}</div>;
}

function VirtualClassGroup({ title, icon, items }: { title: string; icon: React.ReactNode; items: Awaited<ReturnType<typeof listInstructorVirtualClasses>> }) {
  if (!items.length) return null;
  return <section><h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">{icon}{title}</h2><div className="grid gap-4 xl:grid-cols-2">{items.map((item) => <VirtualClassCard key={item.id} item={item} detailHref={`/formateur/classes-virtuelles/${item.id}`} prepareHref={["DRAFT", "SCHEDULED", "OPEN"].includes(item.status) ? `/classes-virtuelles/${item.id}/verification` : undefined} joinHref={["OPEN", "LIVE"].includes(item.status) ? `/classes-virtuelles/${item.id}/verification` : undefined} attendanceLabel={`${item._count.attendances} attendu${item._count.attendances > 1 ? "s" : ""}`} />)}</div></section>;
}
