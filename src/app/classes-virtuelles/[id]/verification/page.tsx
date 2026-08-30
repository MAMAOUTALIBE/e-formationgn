import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { VirtualClassPreJoin } from "@/components/features/virtual-classes/virtual-class-prejoin";
import { virtualClassPersonName } from "@/lib/virtual-class-display";
import { getVirtualClassViewer } from "@/server/queries/virtual-classes";

export default async function VirtualClassPreJoinPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  const { id } = await params;
  const item = await getVirtualClassViewer(id, session.user.id, session.user.role);
  if (!item) notFound();
  if (["ENDED", "CANCELLED"].includes(item.status)) redirect(`/classes-virtuelles/${id}`);
  return <VirtualClassPreJoin id={id} title={item.title} displayName={virtualClassPersonName(session.user)} recordingEnabled={item.recordingEnabled} role={item.viewerRole} />;
}
