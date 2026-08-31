import { ArrowLeft } from "lucide-react";
import Link from "next/link";
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
  // Cohérent avec l'écran de vérification, qui redirige déjà : on ne dépose
  // plus l'utilisateur dans une salle qui ne peut que lui répondre une erreur.
  if (["ENDED", "CANCELLED"].includes(item.status)) redirect(`/classes-virtuelles/${id}`);

  // Volontairement hors de la coque de compte : une salle de cours a besoin de
  // toute la largeur, le menu latéral et l'en-tête amputaient la vidéo d'un
  // tiers de l'écran — et de bien plus en paysage sur mobile.
  return (
    <main className="min-h-[100dvh] bg-[#0b0f14] px-2 py-2 sm:px-4 sm:py-4">
      <div className="mx-auto w-full max-w-[1600px] space-y-2">
        <Link
          href={`/classes-virtuelles/${id}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-white/70 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Quitter la salle
        </Link>
        <VirtualClassRoom
          id={id}
          title={item.title}
          status={item.status}
          // Le direct commence à l'arrivée du formateur ; à défaut, on compte
          // depuis l'ouverture de la salle.
          startedAt={(item.liveStartedAt ?? item.openedAt)?.toISOString() ?? null}
          recordingEnabled={item.recordingEnabled}
          recordingActive={item.recordingActive}
        />
      </div>
    </main>
  );
}
