"use client";

import { DoorOpen, Send, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { openVirtualClass, sendVirtualClassLinkToLearners } from "@/server/actions/virtual-classes";

export function VirtualClassInstructorActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function open() {
    startTransition(async () => {
      const result = await openVirtualClass(id);
      if (!result.success) return window.alert(result.message);
      router.push(`/classes-virtuelles/${id}/verification`);
      router.refresh();
    });
  }
  function sendLink() {
    if (!window.confirm("Envoyer le lien d’accès à tous les apprenants actifs de cette session ?")) return;
    startTransition(async () => {
      const result = await sendVirtualClassLinkToLearners(id);
      window.alert(result.message ?? (result.success ? "Lien envoyé." : "L’envoi a échoué."));
      if (result.success) router.refresh();
    });
  }
  return <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={`/classes-virtuelles/${id}/verification`}><SlidersHorizontal className="h-4 w-4" />Préparer la séance</Link></Button>{status === "SCHEDULED" ? <Button type="button" disabled={pending} onClick={open}><DoorOpen className="h-4 w-4" />Ouvrir la salle</Button> : null}{status === "OPEN" || status === "LIVE" ? <Button asChild><Link href={`/classes-virtuelles/${id}/verification`}><DoorOpen className="h-4 w-4" />Rejoindre la salle</Link></Button> : null}<Button type="button" variant="outline" className="w-full sm:w-auto" onClick={sendLink} disabled={pending || !["SCHEDULED", "OPEN", "LIVE"].includes(status)} title={status === "DRAFT" ? "Programmez la classe avant l’envoi" : undefined}><Send className="h-4 w-4" />Envoyer le lien aux apprenants</Button></div>;
}
