import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { VirtualClassRoom } from "@/components/features/virtual-classes/virtual-class-room";
import { getVirtualClassViewer } from "@/server/queries/virtual-classes";

export default async function VirtualClassRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  const { id } = await params;
  const item = await getVirtualClassViewer(id, session.user.id, session.user.role);
  if (!item) notFound();
  return <VirtualClassRoom id={id} title={item.title} recordingEnabled={item.recordingEnabled} recordingActive={item.recordingActive} />;
}
